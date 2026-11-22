import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import {
    buildDigitProposalRequest,
    DIGIT_CONTRACT_TYPES,
    getDigitDistribution,
} from './digit-analysis';
import type { DigitContractType } from './digit-analysis';
import LiveDigitVisualizer from './live-digit-visualizer';

type TManualSymbol = {
    display_name?: string;
    exchange_is_open?: number | boolean;
    is_trading_suspended?: number | boolean;
    market?: string;
    underlying_symbol?: string;
    underlying_symbol_name?: string;
    symbol?: string;
    pip_size?: number;
};

type TProposal = {
    ask_price: number;
    id: string;
    longcode: string;
    payout: number;
    stake: number;
    currency: string;
    loginid: string;
    symbol: string;
    contractType: DigitContractType;
    barrier: number;
    duration: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

type ManualTradingPanelProps = {
    activeSymbols: TManualSymbol[];
    chartSymbol?: string;
    onSymbolChange: (symbol: string) => void;
};

const CONTRACT_LABELS: Record<DigitContractType, string> = {
    DIGITOVER: localize('Over'),
    DIGITUNDER: localize('Under'),
    DIGITEVEN: localize('Even'),
    DIGITODD: localize('Odd'),
    DIGITMATCH: localize('Matches'),
    DIGITDIFF: localize('Differs'),
};

const ManualTradingPanel = observer(({ activeSymbols, chartSymbol, onSymbolChange }: ManualTradingPanelProps) => {
    const { client } = useStore();
    const [selectedSymbol, setSelectedSymbol] = useState(chartSymbol ?? '');
    const [contractType, setContractType] = useState<DigitContractType>('DIGITOVER');
    const [barrier, setBarrier] = useState('5');
    const [stake, setStake] = useState('1');
    const [duration, setDuration] = useState('1');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [martingaleEnabled, setMartingaleEnabled] = useState(false);
    const [martingaleMultiplier, setMartingaleMultiplier] = useState('2');
    const [scannerResult, setScannerResult] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [proposal, setProposal] = useState<TProposal | null>(null);
    const [analysisPrices, setAnalysisPrices] = useState<Array<number | string>>([]);
    const [analysisPrecision, setAnalysisPrecision] = useState(2);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [isQuoting, setIsQuoting] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const quoteRequestId = useRef(0);
    const buyInFlight = useRef(false);

    const invalidateQuote = useCallback(() => {
        quoteRequestId.current += 1;
        setProposal(null);
        setIsQuoting(false);
    }, []);

    const syntheticSymbols = useMemo(
        () =>
            activeSymbols
                .filter(
                    item =>
                        item.market === 'synthetic_index' &&
                        item.exchange_is_open !== false &&
                        item.exchange_is_open !== 0 &&
                        item.is_trading_suspended !== true &&
                        item.is_trading_suspended !== 1
                )
                .map(item => ({
                    symbol: item.underlying_symbol || item.symbol || '',
                    name: item.underlying_symbol_name || item.display_name || item.underlying_symbol || item.symbol || '',
                    pipSize: item.pip_size,
                }))
                .filter(item => item.symbol),
        [activeSymbols]
    );

    const selectedMarket = syntheticSymbols.find(item => item.symbol === selectedSymbol);
    const distribution = useMemo(
        () => getDigitDistribution(analysisPrices, analysisPrecision),
        [analysisPrices, analysisPrecision]
    );
    const totalTicks = analysisPrices.length;
    const evenCount = distribution.filter(item => item.digit % 2 === 0).reduce((total, item) => total + item.count, 0);
    const oddCount = totalTicks - evenCount;

    useEffect(() => {
        if (syntheticSymbols.length === 0) return;

        const chartMarket = syntheticSymbols.find(item => item.symbol === chartSymbol);
        const nextSymbol = chartMarket?.symbol || syntheticSymbols.find(item => item.symbol === selectedSymbol)?.symbol;
        const symbolToUse = nextSymbol || syntheticSymbols[0].symbol;

        if (symbolToUse !== selectedSymbol) {
            setSelectedSymbol(symbolToUse);
            invalidateQuote();
            if (!chartMarket) onSymbolChange(symbolToUse);
        }
    }, [chartSymbol, invalidateQuote, onSymbolChange, selectedSymbol, syntheticSymbols]);

    useEffect(() => {
        invalidateQuote();
        setMessage('');
        setError('');
    }, [client.currency, client.loginid, invalidateQuote]);

    useEffect(() => {
        const api = chart_api.api;
        if (!api || !selectedSymbol) {
            setAnalysisPrices([]);
            setAnalysisError(localize('Waiting for the market data connection.'));
            return;
        }

        let isCancelled = false;
        let subscriptionId: string | undefined;
        let historyLoaded = false;
        let pendingTicks: Array<number | string> = [];
        const symbolPrecision =
            syntheticSymbols.find(item => item.symbol === selectedSymbol)?.pipSize ??
            api_base.pip_sizes[selectedSymbol] ??
            2;
        const forgetSubscription = () => {
            if (!subscriptionId) return;
            api.send({ forget: subscriptionId }).catch((unsubscribeError: unknown) => {
                console.error('Failed to unsubscribe from manual trading tick analysis:', unsubscribeError);
            });
            subscriptionId = undefined;
        };

        setAnalysisLoading(true);
        setAnalysisError('');
        setAnalysisPrices([]);

        const messageSubscription = api.onMessage().subscribe((message: unknown) => {
            const data = isRecord(message) && isRecord(message.data) ? message.data : null;
            const tick = isRecord(data?.tick) ? data.tick : null;
            if (
                data?.msg_type !== 'tick' ||
                tick?.symbol !== selectedSymbol ||
                (typeof tick?.quote !== 'number' && typeof tick?.quote !== 'string')
            ) {
                return;
            }

            if (typeof tick.pip_size === 'number') setAnalysisPrecision(tick.pip_size);
            const nextTick = tick.quote;

            if (!historyLoaded) {
                pendingTicks = [...pendingTicks, nextTick].slice(-100);
            } else {
                setAnalysisPrices(current => [...current, nextTick].slice(-100));
            }
        });

        api.send({
            ticks_history: selectedSymbol,
            count: 100,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        })
            .then((response: unknown) => {
                const responseData = isRecord(response) ? response : null;
                const responseError = isRecord(responseData?.error) ? responseData.error : null;
                if (responseError) {
                    throw new Error(
                        typeof responseError.message === 'string'
                            ? responseError.message
                            : localize('Could not load tick history.')
                    );
                }

                const subscription = isRecord(responseData?.subscription) ? responseData.subscription : null;
                subscriptionId = typeof subscription?.id === 'string' ? subscription.id : undefined;
                if (isCancelled) {
                    forgetSubscription();
                    return;
                }

                const historyData = isRecord(responseData?.history) ? responseData.history : null;
                const history = historyData?.prices;
                if (!Array.isArray(history)) {
                    forgetSubscription();
                    throw new Error(localize('No tick history was returned for this market.'));
                }

                const validHistory = history.filter(
                    (price): price is number | string => typeof price === 'number' || typeof price === 'string'
                );
                setAnalysisPrecision(
                    typeof responseData?.pip_size === 'number' ? responseData.pip_size : Number(symbolPrecision)
                );
                setAnalysisPrices([...validHistory, ...pendingTicks].slice(-100));
                historyLoaded = true;
                pendingTicks = [];
            })
            .catch((requestError: unknown) => {
                if (!isCancelled) {
                    setAnalysisError(
                        requestError instanceof Error
                            ? requestError.message
                            : localize('Could not load tick history for this market.')
                    );
                }
            })
            .finally(() => {
                if (!isCancelled) setAnalysisLoading(false);
            });

        return () => {
            isCancelled = true;
            messageSubscription.unsubscribe();
            forgetSubscription();
        };
    }, [selectedSymbol, syntheticSymbols]);

    const updateForm = (update: () => void) => {
        update();
        invalidateQuote();
        setMessage('');
        setError('');
    };

    const handleSymbolChange = (nextSymbol: string) => {
        setSelectedSymbol(nextSymbol);
        onSymbolChange(nextSymbol);
        invalidateQuote();
        setMessage('');
        setError('');
    };

    const handleGetQuote = async () => {
        const amount = Number(stake);
        const durationInTicks = Number(duration);
        const prediction = Number(barrier);

        if (!client.is_logged_in || !api_base.is_authorized || !api_base.api) {
            setError(localize('Log in to your Deriv account to request a trade quote.'));
            return;
        }
        if (!selectedSymbol || !Number.isFinite(amount) || amount <= 0) {
            setError(localize('Enter a valid stake and select a synthetic index.'));
            return;
        }
        if (!Number.isInteger(durationInTicks) || durationInTicks < 1 || durationInTicks > 10) {
            setError(localize('Duration must be between 1 and 10 ticks.'));
            return;
        }
        if (contractType !== 'DIGITEVEN' && contractType !== 'DIGITODD') {
            const minimumBarrier = contractType === 'DIGITUNDER' ? 1 : 0;
            const maximumBarrier = contractType === 'DIGITOVER' ? 8 : 9;
            if (!Number.isInteger(prediction) || prediction < minimumBarrier || prediction > maximumBarrier) {
                setError(localize('Enter a valid prediction digit for this contract.'));
                return;
            }
        }

        invalidateQuote();
        const requestId = quoteRequestId.current;
        setIsQuoting(true);
        setMessage('');
        setError('');
        const quoteLoginId = client.loginid;
        const quoteCurrency = client.currency;
        const quoteSymbol = selectedSymbol;
        const quoteContractType = contractType;
        const quoteBarrier = prediction;
        const quoteDuration = durationInTicks;

        try {
            const response = await api_base.api.send(
                buildDigitProposalRequest({
                    amount,
                    barrier: quoteBarrier,
                    contractType: quoteContractType,
                    currency: quoteCurrency,
                    duration: quoteDuration,
                    symbol: quoteSymbol,
                })
            );
            if (requestId !== quoteRequestId.current) return;
            const responseData = isRecord(response) ? response : null;
            const responseError = isRecord(responseData?.error) ? responseData.error : null;
            if (responseError) {
                throw new Error(
                    typeof responseError.message === 'string'
                        ? responseError.message
                        : localize('Could not get a trade quote.')
                );
            }

            const proposalData = isRecord(responseData?.proposal) ? responseData.proposal : null;
            if (
                !proposalData ||
                typeof proposalData.id !== 'string' ||
                !Number.isFinite(Number(proposalData.ask_price)) ||
                Number(proposalData.ask_price) <= 0 ||
                !Number.isFinite(Number(proposalData.payout))
            ) {
                throw new Error(localize('The API did not return a valid trade quote.'));
            }
            if (client.loginid !== quoteLoginId || client.currency !== quoteCurrency) {
                throw new Error(localize('Your selected account changed. Please request a new quote.'));
            }

            setProposal({
                ask_price: Number(proposalData.ask_price),
                id: proposalData.id,
                longcode: typeof proposalData.longcode === 'string' ? proposalData.longcode : '',
                payout: Number(proposalData.payout),
                stake: amount,
                currency: quoteCurrency,
                loginid: quoteLoginId,
                symbol: quoteSymbol,
                contractType: quoteContractType,
                barrier: quoteBarrier,
                duration: quoteDuration,
            });
        } catch (requestError) {
            if (requestId === quoteRequestId.current) {
                setError(
                    requestError instanceof Error ? requestError.message : localize('Could not get a trade quote.')
                );
            }
        } finally {
            if (requestId === quoteRequestId.current) setIsQuoting(false);
        }
    };

    const handleBuy = async () => {
        if (!proposal || !client.is_logged_in || !api_base.is_authorized || !api_base.api) {
            setError(localize('Your account is not ready to place this trade. Please request a new quote.'));
            return;
        }
        if (proposal.loginid !== client.loginid || proposal.currency !== client.currency) {
            setProposal(null);
            setError(localize('Your selected account changed. Please request a new quote.'));
            return;
        }

        if (!client.is_virtual) {
            const contractLabel = `${CONTRACT_LABELS[proposal.contractType]}${
                proposal.contractType === 'DIGITEVEN' || proposal.contractType === 'DIGITODD'
                    ? ''
                    : ` ${proposal.barrier}`
            }`;
            const isConfirmed = window.confirm(
                localize(
                    'Confirm REAL-MONEY trade: {{price}} {{currency}} on {{symbol}} — {{contract}} for {{duration}} tick(s).',
                    {
                        price: proposal.ask_price,
                        currency: proposal.currency,
                        symbol: proposal.symbol,
                        contract: contractLabel,
                        duration: proposal.duration,
                    }
                )
            );
            if (!isConfirmed) return;
        }

        if (buyInFlight.current) return;
        buyInFlight.current = true;
        setIsBuying(true);
        setMessage('');
        setError('');

        try {
            const response = await api_base.api.send({ buy: proposal.id, price: proposal.ask_price });
            const responseData = isRecord(response) ? response : null;
            const responseError = isRecord(responseData?.error) ? responseData.error : null;
            if (responseError) {
                throw new Error(
                    typeof responseError.message === 'string'
                        ? responseError.message
                        : localize('Could not place the trade.')
                );
            }

            const buyData = isRecord(responseData?.buy) ? responseData.buy : null;
            if (!buyData || !buyData.contract_id) throw new Error(localize('The API did not confirm the trade.'));

            setMessage(
                localize('Trade placed successfully. Contract ID: {{contractId}}', {
                    contractId: buyData.contract_id,
                })
            );
            setProposal(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : localize('Could not place the trade.'));
        } finally {
            buyInFlight.current = false;
            setIsBuying(false);
        }
    };

    const formatAmount = (amount: number) =>
        new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);

    const scanLiveMarkets = async () => {
        if (!api_base.api) {
            setScannerResult(localize('The Deriv market connection is not ready.'));
            return;
        }

        setIsScanning(true);
        setScannerResult('');
        const candidates = syntheticSymbols.filter(item =>
            /^(R_|1HZ|JD)/i.test(item.symbol)
        ).slice(0, 12);

        try {
            const results = await Promise.all(candidates.map(async item => {
                const response = await api_base.api!.send({
                    ticks_history: item.symbol,
                    count: 100,
                    end: 'latest',
                    style: 'ticks',
                });
                const data = isRecord(response) ? response : null;
                const history = isRecord(data?.history) ? data.history : null;
                const prices = Array.isArray(history?.prices)
                    ? history.prices.filter((price): price is number | string =>
                        typeof price === 'number' || typeof price === 'string'
                    )
                    : [];
                const distribution = getDigitDistribution(prices, item.pipSize ?? 2);
                const total = prices.length;
                const even = distribution.filter(({ digit, count }) => digit % 2 === 0).reduce((sum, { count }) => sum + count, 0);
                const odd = total - even;
                const strongest = distribution.reduce((best, current) => current.count > best.count ? current : best, distribution[0]);
                const weakest = distribution.reduce((best, current) => current.count < best.count ? current : best, distribution[0]);
                const evenShare = total ? even / total : 0;
                const oddShare = total ? odd / total : 0;
                const contractType: DigitContractType =
                    evenShare >= 0.55 ? 'DIGITODD' :
                    oddShare >= 0.55 ? 'DIGITEVEN' :
                    strongest.count >= weakest.count * 1.15 ? 'DIGITOVER' : 'DIGITUNDER';
                const barrier = strongest.count >= weakest.count
                    ? Math.min(8, Math.max(0, strongest.digit))
                    : weakest.digit;
                const score = Math.abs(evenShare - oddShare) + (total ? (strongest.count - weakest.count) / total : 0);
                return { item, contractType, barrier, score };
            }));

            const best = results.sort((a, b) => b.score - a.score)[0];
            if (!best) throw new Error(localize('No live Volatility or Jump market was available.'));
            setSelectedSymbol(best.item.symbol);
            setContractType(best.contractType);
            setBarrier(String(best.barrier));
            onSymbolChange(best.item.symbol);
            invalidateQuote();
            setScannerResult(
                `${best.item.name}: ${CONTRACT_LABELS[best.contractType]}${
                    best.contractType === 'DIGITEVEN' || best.contractType === 'DIGITODD'
                        ? ''
                        : ` ${best.barrier}`
                } — ${localize('Recommended next step: Run')} (${localize('Get trade quote')})`
            );
        } catch (scannerError) {
            setScannerResult(
                scannerError instanceof Error ? scannerError.message : localize('The live market scan could not be completed.')
            );
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <aside className='manual-trading-panel' aria-label={localize('Manual trading and digit analysis')}>
            <section className='manual-trading-card'>
                <h2>{localize('Manual trading')}</h2>
                <p className='manual-trading-caption'>
                    {localize('Place a single synthetic-index digit contract from your Deriv account.')}
                </p>
                <p className={`manual-trading-account ${client.is_virtual ? '' : 'manual-trading-account--real'}`}>
                    {client.is_logged_in
                        ? client.is_virtual
                            ? localize('Demo account')
                            : localize('REAL account — real money is at risk')
                        : localize('Log in to enable trading.')}
                </p>
                <LiveDigitVisualizer prices={analysisPrices} pipSize={analysisPrecision} />

                <label>
                    {localize('Synthetic index')}
                    <select
                        value={selectedSymbol}
                        onChange={event => handleSymbolChange(event.target.value)}
                        disabled={syntheticSymbols.length === 0 || isQuoting || isBuying}
                    >
                        {syntheticSymbols.map(item => (
                            <option key={item.symbol} value={item.symbol}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    {localize('Contract')}
                    <select
                        value={contractType}
                        onChange={event =>
                            updateForm(() => setContractType(event.target.value as DigitContractType))
                        }
                        disabled={isQuoting || isBuying}
                    >
                        {DIGIT_CONTRACT_TYPES.map(type => (
                            <option key={type} value={type}>
                                {CONTRACT_LABELS[type]}
                            </option>
                        ))}
                    </select>
                </label>

                {contractType !== 'DIGITEVEN' && contractType !== 'DIGITODD' && (
                    <label>
                        {localize('Prediction digit')}
                        <select
                            value={barrier}
                            onChange={event => updateForm(() => setBarrier(event.target.value))}
                            disabled={isQuoting || isBuying}
                        >
                            {Array.from({ length: 10 }, (_, digit) => digit)
                                .filter(digit =>
                                    contractType === 'DIGITOVER'
                                        ? digit <= 8
                                        : contractType === 'DIGITUNDER'
                                          ? digit >= 1
                                          : true
                                )
                                .map(digit => (
                                    <option key={digit} value={digit}>
                                        {digit}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}

                <div className='manual-trading-fields'>
                    <label>
                        {localize('Stake')} ({client.currency})
                        <input
                            type='number'
                            min='0.01'
                            step='0.01'
                            value={stake}
                            onChange={event => updateForm(() => setStake(event.target.value))}
                            disabled={isQuoting || isBuying}
                        />
                    </label>
                    <label>
                        {localize('Duration (ticks)')}
                        <select
                            value={duration}
                            onChange={event => updateForm(() => setDuration(event.target.value))}
                            disabled={isQuoting || isBuying}
                        >
                            {[1, 2, 3, 5, 10, 20, 50].map(ticks => (
                                <option key={ticks} value={ticks}>
                                    {ticks === 1 ? localize('1 Tick') : localize('{{ticks}} Ticks', { ticks })}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className='manual-trading-fields'>
                    <label>
                        {localize('Stop Loss')} ({client.currency})
                        <input
                            type='number'
                            min='0'
                            step='0.01'
                            value={stopLoss}
                            onChange={event => updateForm(() => setStopLoss(event.target.value))}
                            disabled={isQuoting || isBuying}
                            placeholder='0'
                        />
                    </label>
                    <label>
                        {localize('Take Profit')} ({client.currency})
                        <input
                            type='number'
                            min='0'
                            step='0.01'
                            value={takeProfit}
                            onChange={event => updateForm(() => setTakeProfit(event.target.value))}
                            disabled={isQuoting || isBuying}
                            placeholder='0'
                        />
                    </label>
                </div>

                <div className='manual-trading-fields'>
                    <label>
                        {localize('Martingale')}
                        <select
                            value={martingaleEnabled ? 'on' : 'off'}
                            onChange={event =>
                                updateForm(() => setMartingaleEnabled(event.target.value === 'on'))
                            }
                            disabled={isQuoting || isBuying}
                        >
                            <option value='off'>{localize('Off')}</option>
                            <option value='on'>{localize('On')}</option>
                        </select>
                    </label>
                    {martingaleEnabled && (
                        <label>
                            {localize('Martingale multiplier')}
                            <input
                                type='number'
                                min='1.01'
                                step='0.1'
                                value={martingaleMultiplier}
                                onChange={event => updateForm(() => setMartingaleMultiplier(event.target.value))}
                                disabled={isQuoting || isBuying}
                            />
                        </label>
                    )}
                </div>

                <button
                    className='manual-trading-button'
                    type='button'
                    onClick={scanLiveMarkets}
                    disabled={isScanning || syntheticSymbols.length === 0}
                >
                    {isScanning ? localize('Scanning live markets…') : localize('AI Scanner')}
                </button>
                {scannerResult && (
                    <p className='manual-trading-feedback' role='status'>{scannerResult}</p>
                )}

                <button
                    className='manual-trading-button'
                    type='button'
                    onClick={handleGetQuote}
                    disabled={isQuoting || isBuying || !client.is_logged_in || !selectedSymbol}
                >
                    {isQuoting ? localize('Getting quote…') : localize('Get trade quote')}
                </button>

                {proposal && (
                    <div className='manual-trading-quote'>
                        <p>{proposal.longcode}</p>
                        <p>{localize('Stake')}: {formatAmount(proposal.stake)} {proposal.currency}</p>
                        <p>{localize('Purchase price')}: {formatAmount(proposal.ask_price)} {proposal.currency}</p>
                        <p>
                            {localize('Potential payout')}: {formatAmount(proposal.payout)} {proposal.currency}
                        </p>
                        <button
                            className='manual-trading-button manual-trading-button--confirm'
                            type='button'
                            onClick={handleBuy}
                            disabled={isBuying}
                        >
                            {isBuying ? localize('Placing trade…') : localize('Confirm and buy')}
                        </button>
                    </div>
                )}
                {error && (
                    <p className='manual-trading-feedback manual-trading-feedback--error' role='alert'>
                        {error}
                    </p>
                )}
                {message && (
                    <p className='manual-trading-feedback' role='status'>
                        {message}
                    </p>
                )}
            </section>

            <section className='manual-trading-card manual-trading-analysis'>
                <h2>{localize('Analysis Tool — Live Last Digit Visualizer')}</h2>
                <p className='manual-trading-caption'>
                    {selectedMarket?.name || selectedSymbol} · {localize('last 100 ticks')}
                </p>
                {analysisLoading && <p>{localize('Loading tick history…')}</p>}
                {analysisError && (
                    <p className='manual-trading-feedback manual-trading-feedback--error'>{analysisError}</p>
                )}
                {!analysisLoading && !analysisError && (
                    <>
                        <p className='manual-trading-analysis__sample'>
                            {localize('Sample size')}: {totalTicks}
                        </p>
                        <div className='manual-trading-analysis__parity'>
                            <span>
                                {localize('Even')}: {evenCount} (
                                {totalTicks ? Math.round((evenCount / totalTicks) * 100) : 0}%)
                            </span>
                            <span>
                                {localize('Odd')}: {oddCount} (
                                {totalTicks ? Math.round((oddCount / totalTicks) * 100) : 0}%)
                            </span>
                        </div>
                        <LiveDigitVisualizer prices={analysisPrices} pipSize={analysisPrecision} />
                        <p className='manual-trading-caption'>
                            {localize(
                                'Historical digit frequency is descriptive only and does not predict future results.'
                            )}
                        </p>
                    </>
                )}
            </section>
        </aside>
    );
});

export default ManualTradingPanel;
