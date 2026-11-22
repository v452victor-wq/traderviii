import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { localize } from '@deriv-com/translations';
import { getDigitDistribution } from './digit-analysis';
import LiveDigitVisualizer from './live-digit-visualizer';
import './analysis-tool.scss';

type Market = {
    symbol: string;
    name: string;
    pipSize: number;
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const api = chart_api.api;
        if (!api || !symbol) return;
        let cancelled = false;
        let subscriptionId: string | undefined;
        setLoading(true);
        setError('');
        setPrices([]);

        const messageSubscription = api.onMessage().subscribe((message: any) => {
            const tick = message?.data?.tick;
            if (message?.data?.msg_type === 'tick' && tick?.symbol === symbol) {
                setPrices(current => [...current, tick.quote].slice(-100));
                if (typeof tick.pip_size === 'number') setPipSize(tick.pip_size);
            }
        });

        api.send({ ticks_history: symbol, count: 100, end: 'latest', style: 'ticks', subscribe: 1 })
            .then((response: any) => {
                if (cancelled) return;
                if (response?.error) throw new Error(response.error.message);
                const history = response?.history?.prices;
                subscriptionId = response?.subscription?.id;
                if (!Array.isArray(history)) throw new Error(localize('No tick history was returned.'));
                setPipSize(typeof response.pip_size === 'number' ? response.pip_size : pipSize);
                setPrices(history.filter((price: unknown) => typeof price === 'number' || typeof price === 'string').slice(-100));
            })
            .catch((requestError: unknown) => {
                if (!cancelled) setError(requestError instanceof Error ? requestError.message : localize('Could not load tick history.'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            messageSubscription.unsubscribe();
            if (subscriptionId) api.send({ forget: subscriptionId }).catch(() => undefined);
        };
    }, [symbol]);

    const distribution = useMemo(() => getDigitDistribution(prices, pipSize), [prices, pipSize]);
    const even = distribution.filter(({ digit, count }) => digit % 2 === 0).reduce((sum, { count }) => sum + count, 0);
    const odd = prices.length - even;

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
                            <span>{localize('Sample')}: <strong>{prices.length}</strong></span>
                            <span>{localize('Even')}: <strong>{even}</strong></span>
                            <span>{localize('Odd')}: <strong>{odd}</strong></span>
                        </div>
                        <LiveDigitVisualizer prices={prices} pipSize={pipSize} />
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
