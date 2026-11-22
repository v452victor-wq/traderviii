import { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { localize } from '@deriv-com/translations';
import { getDigitDistribution } from './digit-analysis';
import './ai-scanner-button.scss';

type Position = { x: number; y: number };

const AiScannerButton = observer(() => {
    const { dashboard, run_panel } = useStore();
    const [position, setPosition] = useState<Position>(() => ({
        x: Math.max(16, window.innerWidth - 84),
        y: Math.max(16, window.innerHeight - 100),
    }));
    const [dragOffset, setDragOffset] = useState<Position | null>(null);
    const moved = useRef(false);
    const [result, setResult] = useState('');
    const [open, setOpen] = useState(false);
    const [scanning, setScanning] = useState(false);

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
        if (!moved.current) void scanMarkets();
    };

    const scanMarkets = async () => {
        if (!api_base.api) {
            setResult(localize('The Deriv market connection is not ready.'));
            setOpen(true);
            return;
        }
        setOpen(true);
        setScanning(true);
        setResult(localize('Scanning Volatility and Jump indices…'));

        const candidates = (api_base.active_symbols || [])
            .filter((item: any) => item.market === 'synthetic_index' && /^(R_|1HZ|JD)/i.test(item.underlying_symbol || item.symbol || ''))
            .slice(0, 12);

        try {
            const scanned = await Promise.all(candidates.map(async (item: any) => {
                const symbol = item.underlying_symbol || item.symbol;
                const response: any = await api_base.api.send({
                    ticks_history: symbol,
                    count: 100,
                    end: 'latest',
                    style: 'ticks',
                });
                const prices = response?.history?.prices?.filter((value: unknown) => typeof value === 'number' || typeof value === 'string') || [];
                const distribution = getDigitDistribution(prices, item.pip_size || 2);
                const even = distribution.filter(({ digit }) => digit % 2 === 0).reduce((sum, { count }) => sum + count, 0);
                const odd = prices.length - even;
                const evenShare = prices.length ? even / prices.length : 0;
                const oddShare = prices.length ? odd / prices.length : 0;
                const strongest = distribution.reduce((best, current) => current.count > best.count ? current : best, distribution[0]);
                const weakest = distribution.reduce((best, current) => current.count < best.count ? current : best, distribution[0]);
                const isEven = evenShare >= oddShare + 0.08;
                const isOdd = oddShare >= evenShare + 0.08;
                const recommendation = isEven ? 'Odd' : isOdd ? 'Even' : strongest.count > weakest.count ? 'Over' : 'Under';
                const score = Math.abs(evenShare - oddShare) + (prices.length ? (strongest.count - weakest.count) / prices.length : 0);
                return { name: item.display_name || item.underlying_symbol_name || symbol, symbol, recommendation, score };
            }));
            const best = scanned.sort((a, b) => b.score - a.score)[0];
            if (!best) throw new Error(localize('No live Volatility or Jump market was available.'));
            setResult(
                `${best.name}: ${best.recommendation} — ${localize('Recommended next step: Load to Bot Builder')} `
            );
        } catch (scannerError) {
            setResult(scannerError instanceof Error ? scannerError.message : localize('The live market scan could not be completed.'));
        } finally {
            setScanning(false);
        }
    };

    const runRecommendation = () => {
        setOpen(false);
        run_panel.onRunButtonClick();
    };

    const loadRecommendation = () => {
        setOpen(false);
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    return (
        <div className='ai-scanner'>
            {open && (
                <aside className='ai-scanner__result' role='status'>
                    <button className='ai-scanner__close' type='button' aria-label={localize('Close')} onClick={() => setOpen(false)}>×</button>
                    <strong>{localize('AI Scanner')}</strong>
                    <p>{result}</p>
                    <div className='ai-scanner__actions'>
                        <button type='button' onClick={runRecommendation} disabled={scanning}>{localize('Run')}</button>
                        <button type='button' onClick={loadRecommendation} disabled={scanning}>{localize('Load to Bot Builder')}</button>
                    </div>
                </aside>
            )}
            <button
                type='button'
                className={`ai-scanner__button${scanning ? ' ai-scanner__button--scanning' : ''}`}
                style={{ left: position.x, top: position.y }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                aria-label={localize('AI Scanner')}
            >
                <span>AI</span>
                <small>{localize('Scanner')}</small>
            </button>
        </div>
    );
});

export default AiScannerButton;
