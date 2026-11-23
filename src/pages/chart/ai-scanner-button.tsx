import { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { localize } from '@deriv-com/translations';
import { buildDigitProposalRequest, getDigitDistribution, getLastDigit } from './digit-analysis';
import { buildMasterBotXml, FREE_BOT_TEMPLATES } from '../free-bots/bot-templates';
import './ai-scanner-button.scss';

type Position = { x: number; y: number };
type ScannerRecommendation = {
    name: string;
    symbol: string;
    targetDigit: number;
    targetFrequency: number;
    sampleSize: number;
    pipSize: number;
    recoveryContract: 'DIGITEVEN' | 'DIGITODD';
    score: number;
};

const isRecord = (value: unknown): value is Record<string, any> =>
    typeof value === 'object' && value !== null;

const waitForContractResult = async (api: any, contractId: string) => {
    let subscriptionId: string | undefined;
    let resolveResult: (contract: Record<string, any>) => void = () => undefined;
    let rejectResult: (error: Error) => void = () => undefined;
    const result = new Promise<Record<string, any>>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });
    const timeout = window.setTimeout(
        () => rejectResult(new Error(localize('Timed out waiting for the Deriv contract result.'))),
        120_000
    );
    const messageSubscription = api.onMessage().subscribe((message: unknown) => {
        const data = isRecord(message) && isRecord(message.data) ? message.data : null;
        const contract = isRecord(data?.proposal_open_contract) ? data.proposal_open_contract : null;
        if (
            contract &&
            String(contract.contract_id) === contractId &&
            (contract.is_sold === 1 || contract.status === 'sold')
        ) {
            resolveResult(contract);
        }
    });

    try {
        const response = await api.send({
            proposal_open_contract: 1,
            contract_id: contractId,
            subscribe: 1,
        });
        const responseData = isRecord(response) ? response : null;
        if (isRecord(responseData?.error)) {
            throw new Error(
                typeof responseData.error.message === 'string'
                    ? responseData.error.message
                    : localize('Could not subscribe to the Deriv contract result.')
            );
        }
        subscriptionId =
            isRecord(responseData?.subscription) && typeof responseData.subscription.id === 'string'
                ? responseData.subscription.id
                : undefined;
        const initialContract = isRecord(responseData?.proposal_open_contract)
            ? responseData.proposal_open_contract
            : null;
        if (
            initialContract &&
            (initialContract.is_sold === 1 || initialContract.status === 'sold')
        ) {
            return initialContract;
        }

        return await result;
    } finally {
        window.clearTimeout(timeout);
        messageSubscription.unsubscribe();
        if (subscriptionId) {
            api.send({ forget: subscriptionId }).catch((unsubscribeError: unknown) => {
                console.error('Failed to unsubscribe from AI Scanner contract updates:', unsubscribeError);
            });
        }
    }
};

const AiScannerButton = observer(() => {
    const { client, dashboard, load_modal, run_panel } = useStore();
    const [position, setPosition] = useState<Position>(() => ({
        x: Math.max(16, window.innerWidth - 84),
        y: Math.max(16, window.innerHeight - 100),
    }));
    const [dragOffset, setDragOffset] = useState<Position | null>(null);
    const moved = useRef(false);
    const stopRequested = useRef(false);
    const [recommendation, setRecommendation] = useState<ScannerRecommendation | null>(null);
    const [message, setMessage] = useState('');
    const [open, setOpen] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [stake, setStake] = useState('1');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');

    const scanMarkets = async () => {
        const api = api_base.api;
        if (!api) {
            setRecommendation(null);
            setMessage(localize('The Deriv market connection is not ready.'));
            setOpen(true);
            return;
        }

        setOpen(true);
        setScanning(true);
        setRecommendation(null);
        setMessage(localize('Scanning Volatility and Jump indices for Differs setups…'));
        const candidates = (api_base.active_symbols || [])
            .filter(
                (item: any) =>
                    item.market === 'synthetic_index' &&
                    /^(R_|1HZ|JD)/i.test(item.underlying_symbol || item.symbol || '')
            )
            .slice(0, 12);

        try {
            const results = await Promise.allSettled(
                candidates.map(async (item: any) => {
                    const symbol = item.underlying_symbol || item.symbol;
                    const response: unknown = await api.send({
                        ticks_history: symbol,
                        count: 100,
                        end: 'latest',
                        style: 'ticks',
                    });
                    const responseData = isRecord(response) ? response : null;
                    if (isRecord(responseData?.error)) {
                        throw new Error(
                            typeof responseData.error.message === 'string'
                                ? responseData.error.message
                                : localize('Could not read tick history for {{symbol}}.', { symbol })
                        );
                    }
                    const history = isRecord(responseData?.history) ? responseData.history : null;
                    const prices = Array.isArray(history?.prices)
                        ? history.prices.filter(
                              (value: unknown): value is number | string =>
                                  typeof value === 'number' || typeof value === 'string'
                          )
                        : [];
                    if (!prices.length) return null;

                    const pipSize =
                        typeof responseData?.pip_size === 'number' ? responseData.pip_size : item.pip_size || 2;
                    const distribution = getDigitDistribution(prices, pipSize);
                    const leastFrequent = distribution.reduce((least, current) =>
                        current.count < least.count ? current : least
                    );
                    const mostFrequent = distribution.reduce((most, current) =>
                        current.count > most.count ? current : most
                    );
                    const latestDigit = getLastDigit(prices[prices.length - 1], pipSize);
                    if (latestDigit === null) return null;

                    return {
                        name: item.display_name || item.underlying_symbol_name || symbol,
                        symbol,
                        targetDigit: leastFrequent.digit,
                        targetFrequency: leastFrequent.count,
                        sampleSize: prices.length,
                        pipSize,
                        recoveryContract: latestDigit % 2 === 0 ? 'DIGITODD' : 'DIGITEVEN',
                        score: (mostFrequent.count - leastFrequent.count) / prices.length,
                    } satisfies ScannerRecommendation;
                })
            );

            const rejected = results.filter(result => result.status === 'rejected');
            const available = results.flatMap(result =>
                result.status === 'fulfilled' && result.value ? [result.value] : []
            );
            const best = available
                .sort((left, right) => right.score - left.score)[0];
            if (!best) {
                const firstError = rejected[0]?.status === 'rejected' ? rejected[0].reason : null;
                throw firstError instanceof Error
                    ? firstError
                    : new Error(localize('No usable live Volatility or Jump tick history was available.'));
            }
            setRecommendation(best);
            setMessage(
                rejected.length
                    ? localize('Some markets could not be scanned; this recommendation uses the available tick histories.')
                    : ''
            );
        } catch (scannerError) {
            setMessage(
                scannerError instanceof Error
                    ? scannerError.message
                    : localize('The live market scan could not be completed.')
            );
        } finally {
            setScanning(false);
        }
    };

    const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        moved.current = false;
        setDragOffset({ x: event.clientX - position.x, y: event.clientY - position.y });
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!dragOffset) return;
        const next = {
            x: Math.max(8, Math.min(window.innerWidth - 68, event.clientX - dragOffset.x)),
            y: Math.max(8, Math.min(window.innerHeight - 68, event.clientY - dragOffset.y)),
        };
        if (Math.abs(next.x - position.x) + Math.abs(next.y - position.y) > 3) moved.current = true;
        setPosition(next);
    };

    const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDragOffset(null);
    };

    const loadRecommendation = async () => {
        if (!recommendation) return;
        if (run_panel.is_running) {
            setMessage(localize('Stop the running bot before loading another strategy.'));
            return;
        }
        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace) {
            setMessage(localize('Bot Builder is still loading. Please try again in a moment.'));
            return;
        }
        if (
            !window.confirm(
                localize('Loading this strategy replaces the current Bot Builder workspace. Continue?')
            )
        ) {
            return;
        }

        setScanning(true);
        setMessage(localize('Loading the Differs strategy into Bot Builder…'));
        try {
            const bot = FREE_BOT_TEMPLATES.find(template => template.contractType === 'DIGITDIFF');
            if (!bot) throw new Error(localize('The Differs strategy template is unavailable.'));
            const baseStake = Number(stake);
            const xml = buildMasterBotXml(bot, {
                consecutiveTicks: 1,
                stake: baseStake,
                stopLoss: Number(stopLoss),
                takeProfit: Number(takeProfit),
                martingale: true,
                martingaleMultiplier: 1.3,
                tickDuration: 1,
                symbol: recommendation.symbol,
                targetDigit: recommendation.targetDigit,
            });
            const strategyId = `ai-scanner-${Date.now()}`;
            const loaded = await load_modal.loadStrategyToBuilder(
                {
                    id: strategyId,
                    name: `AI Scanner Differs — ${recommendation.symbol}`,
                    save_type: save_types.UNSAVED,
                    timestamp: Date.now(),
                    xml,
                },
                false
            );
            if (!loaded || workspace.current_strategy_id !== strategyId) {
                throw new Error(localize('The scanner strategy could not be loaded into Bot Builder.'));
            }

            dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            setMessage(localize('The Differs strategy was loaded. Review it in Bot Builder before running.'));
        } catch (loadError) {
            setMessage(
                loadError instanceof Error
                    ? loadError.message
                    : localize('The scanner strategy could not be loaded into Bot Builder.')
            );
        } finally {
            setScanning(false);
        }
    };

    const runRecovery = async () => {
        const api = api_base.api;
        const baseStake = Number(stake);
        const lossLimit = Number(stopLoss);
        const profitLimit = Number(takeProfit);
        if (!recommendation || !api || !client.is_logged_in || !api_base.is_authorized) {
            setMessage(localize('Log in to your Deriv account to run this recommendation.'));
            return;
        }
        if (run_panel.is_running) {
            setMessage(localize('Stop the running bot before starting scanner recovery.'));
            return;
        }
        if (!Number.isFinite(baseStake) || baseStake <= 0 || !Number.isFinite(lossLimit) || lossLimit <= 0) {
            setMessage(localize('Enter a valid stake and a Stop Loss above zero before running recovery.'));
            return;
        }
        if (!Number.isFinite(profitLimit) || profitLimit < 0) {
            setMessage(localize('Enter a valid Take Profit amount or leave it at zero.'));
            return;
        }
        if (
            !client.is_virtual &&
            !window.confirm(
                localize(
                    'Confirm REAL-MONEY AI Scanner run on {{symbol}}. It starts with Differs {{digit}}, then uses Even/Odd recovery at +30% stake after a loss. Stop Loss: {{stopLoss}} {{currency}}. Take Profit: {{takeProfit}} {{currency}}.',
                    {
                        symbol: recommendation.symbol,
                        digit: recommendation.targetDigit,
                        stopLoss: lossLimit,
                        takeProfit: profitLimit,
                        currency: client.currency,
                    }
                )
            )
        ) {
            return;
        }

        stopRequested.current = false;
        setIsRunning(true);
        setScanning(true);
        setMessage(localize('Starting with the recommended Differs contract…'));
        let currentStake = baseStake;
        let totalProfit = 0;
        let contractType: 'DIGITDIFF' | 'DIGITEVEN' | 'DIGITODD' = 'DIGITDIFF';

        try {
            while (!stopRequested.current) {
                if (currentStake > lossLimit + totalProfit) {
                    setMessage(localize('Stop Loss limit reached. No further recovery trade was placed.'));
                    break;
                }
                const proposalResponse: unknown = await api.send(
                    buildDigitProposalRequest({
                        amount: currentStake,
                        barrier: recommendation.targetDigit,
                        contractType,
                        currency: client.currency,
                        duration: 1,
                        symbol: recommendation.symbol,
                    })
                );
                const proposalData = isRecord(proposalResponse) ? proposalResponse : null;
                if (isRecord(proposalData?.error)) {
                    throw new Error(
                        typeof proposalData.error.message === 'string'
                            ? proposalData.error.message
                            : localize('Could not get the recovery trade quote.')
                    );
                }
                const proposal = isRecord(proposalData?.proposal) ? proposalData.proposal : null;
                if (
                    !proposal ||
                    typeof proposal.id !== 'string' ||
                    !Number.isFinite(Number(proposal.ask_price)) ||
                    Number(proposal.ask_price) <= 0
                ) {
                    throw new Error(localize('Deriv did not return a valid recovery trade quote.'));
                }
                if (stopRequested.current) break;

                const buyResponse: unknown = await api.send({
                    buy: proposal.id,
                    price: Number(proposal.ask_price),
                });
                const buyData = isRecord(buyResponse) ? buyResponse : null;
                if (isRecord(buyData?.error)) {
                    throw new Error(
                        typeof buyData.error.message === 'string'
                            ? buyData.error.message
                            : localize('Could not place the scanner trade.')
                    );
                }
                const buy = isRecord(buyData?.buy) ? buyData.buy : null;
                if (!buy?.contract_id) throw new Error(localize('Deriv did not confirm the scanner trade.'));

                setMessage(
                    localize('Waiting for {{contract}} contract {{id}} to settle…', {
                        contract: contractType,
                        id: buy.contract_id,
                    })
                );
                const settledContract = await waitForContractResult(api, String(buy.contract_id));
                const profit = Number(settledContract.profit);
                if (!Number.isFinite(profit)) {
                    throw new Error(localize('The settled contract did not include a valid profit result.'));
                }
                totalProfit += profit;

                if (totalProfit <= -lossLimit) {
                    setMessage(
                        localize('Stop Loss reached. Scanner recovery stopped at {{profit}} {{currency}}.', {
                            profit: totalProfit.toFixed(2),
                            currency: client.currency,
                        })
                    );
                    break;
                }
                if (profitLimit > 0 && totalProfit >= profitLimit) {
                    setMessage(
                        localize('Take Profit reached. Scanner recovery stopped at {{profit}} {{currency}}.', {
                            profit: totalProfit.toFixed(2),
                            currency: client.currency,
                        })
                    );
                    break;
                }
                if (stopRequested.current) break;

                if (profit > 0) {
                    currentStake = baseStake;
                    contractType = 'DIGITDIFF';
                    setMessage(localize('Recovery won. Resetting to the recommended Differs setup.'));
                } else {
                    currentStake = Number((currentStake * 1.3).toFixed(2));
                    const exitTick = settledContract.exit_tick_display_value ?? settledContract.exit_tick;
                    const exitDigit = getLastDigit(exitTick, recommendation.pipSize);
                    if (exitDigit === null) {
                        throw new Error(localize('Could not read the final digit for Even/Odd recovery.'));
                    }
                    contractType = exitDigit % 2 === 0 ? 'DIGITODD' : 'DIGITEVEN';
                    setMessage(
                        localize(
                            'Loss recorded. Next: {{contract}} recovery at {{stake}} {{currency}} (+30% of the previous stake).',
                            {
                                contract: contractType === 'DIGITODD' ? localize('Odd') : localize('Even'),
                                stake: currentStake.toFixed(2),
                                currency: client.currency,
                            }
                        )
                    );
                }
            }
            if (stopRequested.current) setMessage(localize('Scanner stopped after the current contract settled.'));
        } catch (runError) {
            setMessage(
                runError instanceof Error
                    ? runError.message
                    : localize('The scanner recovery run could not be completed.')
            );
        } finally {
            setIsRunning(false);
            setScanning(false);
        }
    };

    return (
        <div className='ai-scanner'>
            {open && (
                <aside className='ai-scanner__result' role='status'>
                    <button
                        className='ai-scanner__close'
                        type='button'
                        aria-label={localize('Close')}
                        onClick={() => setOpen(false)}
                    >
                        ×
                    </button>
                    <strong>{localize('AI Scanner — Differs Only')}</strong>
                    <div className='ai-scanner__settings'>
                        <label>
                            {localize('Stake')} ({client.currency})
                            <input type='number' min='0.01' step='0.01' value={stake} onChange={event => setStake(event.target.value)} />
                        </label>
                        <label>
                            {localize('Stop Loss')} ({client.currency})
                            <input type='number' min='0.01' step='0.01' value={stopLoss} onChange={event => setStopLoss(event.target.value)} />
                        </label>
                        <label>
                            {localize('Take Profit')} ({client.currency})
                            <input type='number' min='0' step='0.01' value={takeProfit} onChange={event => setTakeProfit(event.target.value)} />
                        </label>
                    </div>
                    {recommendation && (
                        <p>
                            {localize(
                                '{{market}} — Differs target {{digit}} ({{frequency}}% of {{sample}} ticks). After a loss, recovery uses {{recovery}} based on the settled tick digit, increasing the previous stake by 30%.',
                                {
                                    market: recommendation.name,
                                    digit: recommendation.targetDigit,
                                    frequency: ((recommendation.targetFrequency / recommendation.sampleSize) * 100).toFixed(1),
                                    sample: recommendation.sampleSize,
                                    recovery:
                                        recommendation.recoveryContract === 'DIGITODD'
                                            ? localize('Odd when the exit digit is even')
                                            : localize('Even when the exit digit is odd'),
                                }
                            )}
                        </p>
                    )}
                    {message && <p>{message}</p>}
                    <div className='ai-scanner__actions'>
                        {isRunning ? (
                            <button type='button' onClick={() => (stopRequested.current = true)}>
                                {localize('Stop after current trade')}
                            </button>
                        ) : (
                            <button type='button' onClick={runRecovery} disabled={scanning || !recommendation}>
                                {localize('Run')}
                            </button>
                        )}
                        <button
                            type='button'
                            onClick={() => void loadRecommendation()}
                            disabled={scanning || !recommendation}
                        >
                            {localize('Load to Bot Builder')}
                        </button>
                    </div>
                    {recommendation && (
                        <p className='ai-scanner__builder-note'>
                            {localize('Next action: Run to trade Differs and enable Even/Odd recovery after losses, or Load to Bot Builder to review the Differs-only strategy.')}
                        </p>
                    )}
                </aside>
            )}
            <button
                type='button'
                className={`ai-scanner__button${scanning ? ' ai-scanner__button--scanning' : ''}`}
                style={{ left: position.x, top: position.y }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDragOffset(null)}
                onClick={() => {
                    if (moved.current) {
                        moved.current = false;
                        return;
                    }
                    void scanMarkets();
                }}
                aria-label={localize('AI Scanner')}
            >
                <span>AI</span>
                <small>{localize('Scanner')}</small>
            </button>
        </div>
    );
});

export default AiScannerButton;
