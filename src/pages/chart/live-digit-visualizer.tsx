import { useMemo } from 'react';
import { getDigitDistribution } from './digit-analysis';

type LiveDigitVisualizerProps = {
    prices: Array<number | string>;
    pipSize: number;
};

const LiveDigitVisualizer = ({ prices, pipSize }: LiveDigitVisualizerProps) => {
    const distribution = useMemo(() => getDigitDistribution(prices, pipSize), [prices, pipSize]);
    const total = prices.length;
    const highest = total ? Math.max(...distribution.map(({ count }) => count)) : 0;
    const lowest = total ? Math.min(...distribution.map(({ count }) => count)) : 0;
    const latestDigit = useMemo(() => {
        if (!prices.length) return null;
        const price = Number(prices[prices.length - 1]);
        if (!Number.isFinite(price)) return null;
        const precision = Number.isInteger(pipSize) && pipSize >= 0 && pipSize <= 10 ? pipSize : 2;
        const text = price.toFixed(precision).replace('.', '');
        return Number(text.slice(-1));
    }, [prices, pipSize]);

    return (
        <div className='live-digit-visualizer' aria-label='Live last digit frequency'>
            {[0, 1].map(row => (
                <div className='live-digit-visualizer__row' key={row}>
                    {distribution.slice(row * 5, row * 5 + 5).map(({ digit, count }) => {
                        const percentage = total ? (count / total) * 100 : 0;
                        const isHigh = total > 0 && count === highest;
                        const isLow = total > 0 && count === lowest;
                        const isActive = latestDigit === digit;
                        return (
                            <div
                                className={[
                                    'live-digit-visualizer__item',
                                    isHigh ? 'live-digit-visualizer__item--high' : '',
                                    isLow ? 'live-digit-visualizer__item--low' : '',
                                    isActive ? 'live-digit-visualizer__item--active' : '',
                                ].join(' ')}
                                key={digit}
                            >
                                <span className='live-digit-visualizer__circle'>
                                    <strong>{digit}</strong>
                                    <small>{percentage.toFixed(1)}%</small>
                                </span>
                                <span className='live-digit-visualizer__pointer' aria-hidden='true'>▼</span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default LiveDigitVisualizer;
