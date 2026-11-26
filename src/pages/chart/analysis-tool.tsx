import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { localize } from '@deriv-com/translations';
import { getLastDigit } from './digit-analysis';
import LiveDigitVisualizer from './live-digit-visualizer';
import './analysis-tool.scss';

type Market = {
    symbol: string;
    name: string;
    pipSize: number;
};

type TickPrice = {
    quote: number | string;
    pipSize?: number;
};

type AnalysisApi = {
    onMessage: () => {
        subscribe: (listener: (message: unknown) => void) => { unsubscribe: () => void };
    };
    send: (request: Record<string, unknown>) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const createDigitCounts = (ticks: TickPrice[], fallbackPipSize: number) => {
    const counts = Array.from({ length: 10 }, () => 0);
    ticks.forEach(({ quote, pipSize }) => {
        const digit = getLastDigit(quote, pipSize ?? fallbackPipSize);
        if (digit !== null) counts[digit] += 1;
    });
    return counts;
};

const incrementDigitCount = (counts: number[], quote: number | string, pipSize: number) => {
    const digit = getLastDigit(quote, pipSize);
    if (digit === null) return counts;

    return counts.map((count, index) => (index === digit ? count + 1 : count));
};

const AnalysisTool = observer(() => {
    const markets = useMemo<Market[]>(
        () =>
            (api_base.active_symbols || [])
                .filter((item: any) => item.market === 'synthetic_index' && /^(R_|1HZ|JD)/i.test(item.underlying_symbol || item.symbol || ''))
                .map((item: any) => ({
                    symbol: item.underlying_symbol || item.symbol,
                    name: item.display_name || item.underlying_symbol_name || item.underlying_symbol || item.symbol,
                    pipSize: item.pip_size || 2,
                })),
        []
    );
    const [symbol, setSymbol] = useState(markets[0]?.symbol || '');
    const [prices, setPrices] = useState<Array<number | string>>([]);
    const [pipSize, setPipSize] = useState(markets[0]?.pipSize || 2);
    const [digitCounts, setDigitCounts] = useState<number[]>(() => Array.from({ length: 10 }, () => 0));
    const [tickSequence, setTickSequence] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;
        let api: AnalysisApi | undefined;
        let subscriptionId: string | undefined;
        let messageSubscription: { unsubscribe: () => void } | undefined;
        const marketPipSize = markets.find(market => market.symbol === symbol)?.pipSize ?? 2;
        let effectivePipSize = marketPipSize;
        let latestTickPipSize: number | undefined;
        const pendingTicks: TickPrice[] = [];
        let historyLoaded = false;
        setLoading(true);
        setError('');
        setPrices([]);
        setDigitCounts(Array.from({ length: 10 }, () => 0));
        setTickSequence(0);
        setPipSize(effectivePipSize);

        const forgetSubscription = () => {
            if (!api || !subscriptionId) return;
            api.send({ forget: subscriptionId }).catch((unsubscribeError: unknown) => {
                console.error('Failed to unsubscribe from Analysis Tool tick data:', unsubscribeError);
            });
            subscriptionId = undefined;
        };

        const handleMessage = (message: unknown) => {
            const data = isRecord(message) && isRecord(message.data) ? message.data : null;
            const tick = isRecord(data?.tick) ? data.tick : null;
            const quote = tick?.quote;
            if (
                data?.msg_type !== 'tick' ||
                tick?.symbol !== symbol ||
                (typeof quote !== 'number' && typeof quote !== 'string')
            ) {
                return;
            }

            const tickPipSize = typeof tick.pip_size === 'number' ? tick.pip_size : undefined;
            if (tickPipSize !== undefined) {
                effectivePipSize = tickPipSize;
                latestTickPipSize = tickPipSize;
                setPipSize(tickPipSize);
            }
            const nextTick = { quote, pipSize: tickPipSize };

            if (!historyLoaded) {
                pendingTicks.push(nextTick);
                setTickSequence(current => current + 1);
                return;
            }

            const nextPipSize = tickPipSize ?? effectivePipSize;
            setTickSequence(current => current + 1);
            setPrices(current => [...current, quote].slice(-100));
            setDigitCounts(current => incrementDigitCount(current, quote, nextPipSize));
        };

        const loadTicks = async () => {
            try {
                api = chart_api.api ?? api_base.api;
                if (!api) {
                    await chart_api.init();
                    api = chart_api.api ?? api_base.api;
                }
                if (!api) throw new Error(localize('Live market connection is unavailable.'));
                if (cancelled) return;

                messageSubscription = api.onMessage().subscribe(handleMessage);
                const response = await api.send({
                    ticks_history: symbol,
                    count: 100,
                    end: 'latest',
                    style: 'ticks',
                    subscribe: 1,
                });
                const responseData = isRecord(response) ? response : null;
                const subscription = isRecord(responseData?.subscription) ? responseData.subscription : null;
                subscriptionId = typeof subscription?.id === 'string' ? subscription.id : undefined;
                if (cancelled) {
                    forgetSubscription();
                    return;
                }
                const responseError = isRecord(responseData?.error) ? responseData.error : null;
                if (responseError) {
                    throw new Error(
                        typeof responseError.message === 'string'
                            ? responseError.message
                            : localize('Could not load tick history.')
                    );
                }
                const historyData = isRecord(responseData?.history) ? responseData.history : null;
                const history = historyData?.prices;
                if (!Array.isArray(history)) throw new Error(localize('No tick history was returned.'));
                const historyPipSize =
                    typeof responseData?.pip_size === 'number' ? responseData.pip_size : marketPipSize;
                effectivePipSize = latestTickPipSize ?? historyPipSize;
                setPipSize(effectivePipSize);
                const validHistory = history.filter(
                    (price: unknown): price is number | string =>
                        typeof price === 'number' || typeof price === 'string'
                );
                const historyTicks = validHistory.map(quote => ({ quote, pipSize: historyPipSize }));
                const allTicks = [...historyTicks, ...pendingTicks];
                setDigitCounts(createDigitCounts(allTicks, historyPipSize));
                setPrices(allTicks.map(({ quote }) => quote).slice(-100));
                pendingTicks.length = 0;
                historyLoaded = true;
            } catch (requestError: unknown) {
                historyLoaded = true;
                pendingTicks.length = 0;
                forgetSubscription();
                if (!cancelled) setError(requestError instanceof Error ? requestError.message : localize('Could not load tick history.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadTicks();

        return () => {
            cancelled = true;
            messageSubscription?.unsubscribe();
            forgetSubscription();
        };
    }, [markets, symbol]);

    const distribution = useMemo(
        () => digitCounts.map((count, digit) => ({ digit, count })),
        [digitCounts]
    );
    const sampleCount = distribution.reduce((sum, { count }) => sum + count, 0);
    const even = distribution.filter(({ digit, count }) => digit % 2 === 0).reduce((sum, { count }) => sum + count, 0);
    const odd = sampleCount - even;

    return (
        <main className='analysis-tool' aria-labelledby='analysis-tool-title'>
            <header className='analysis-tool__header'>
                <div>
                    <span className='analysis-tool__eyebrow'>{localize('LIVE MARKET ANALYSIS')}</span>
                    <h1 id='analysis-tool-title'>{localize('Last Digit Visualizer')}</h1>
                </div>
                <label>
                    {localize('Market')}
                    <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                        {markets.map(market => (
                            <option key={market.symbol} value={market.symbol}>{market.name}</option>
                        ))}
                    </select>
                </label>
            </header>
            <section className='analysis-tool__panel'>
                {loading && <p>{localize('Loading live ticks…')}</p>}
                {error && <p className='analysis-tool__error' role='alert'>{error}</p>}
                {!loading && !error && (
                    <>
                        <div className='analysis-tool__stats'>
                            <span>{localize('Sample')}: <strong>{sampleCount}</strong></span>
                            <span>{localize('Even')}: <strong>{even}</strong></span>
                            <span>{localize('Odd')}: <strong>{odd}</strong></span>
                        </div>
                        <LiveDigitVisualizer
                            prices={prices}
                            pipSize={pipSize}
                            digitCounts={digitCounts}
                            tickSequence={tickSequence}
                        />
                        <p className='analysis-tool__note'>
                            {localize('The moving pointer shows the active latest digit. Historical frequency is descriptive and does not predict future results.')}
                        </p>
                    </>
                )}
            </section>
        </main>
    );
});

export default AnalysisTool;
