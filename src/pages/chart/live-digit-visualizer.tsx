import { useMemo } from 'react';
import { getDigitDistribution, getLastDigit } from './digit-analysis';

type LiveDigitVisualizerProps = {
    prices: Array<number | string>;
    pipSize: number;
    digitCounts?: number[];
    tickSequence?: number;
};

const LiveDigitVisualizer = ({ prices, pipSize, digitCounts, tickSequence }: LiveDigitVisualizerProps) => {
    const distribution = useMemo(
        () =>
            digitCounts
                ? Array.from({ length: 10 }, (_, digit) => ({ digit, count: digitCounts[digit] ?? 0 }))
                : getDigitDistribution(prices, pipSize),
        [digitCounts, prices, pipSize]
    );
    const total = distribution.reduce((sum, { count }) => sum + count, 0);
    const highest = total ? Math.max(...distribution.map(({ count }) => count)) : 0;
    const lowest = total ? Math.min(...distribution.map(({ count }) => count)) : 0;
    const latestDigit = useMemo(
        () => (prices.length ? getLastDigit(prices[prices.length - 1], pipSize) : null),
        [prices, pipSize]
    );

    return (
        <div className='live-digit-visualizer' aria-label='Live last digit frequency'>
            {[distribution.slice(0, 5), distribution.slice(5, 10)].map((row, rowIndex) => (
                <div className='live-digit-visualizer__row' key={rowIndex}>
                    {row.map(({ digit, count }) => {
                        const percentage = total ? (count / total) * 100 : 0;
                        const isHigh = total > 0 && count === highest;
                        const isLow = total > 0 && count === lowest && count < highest;
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
                                <span
                                    className={[
                                        'live-digit-visualizer__pointer',
                                        isActive && tickSequence !== undefined && tickSequence % 2 === 0
                                            ? 'live-digit-visualizer__pointer--pulse-even'
                                            : '',
                                        isActive && tickSequence !== undefined && tickSequence % 2 !== 0
                                            ? 'live-digit-visualizer__pointer--pulse-odd'
                                            : '',
                                    ].join(' ')}
                                    aria-hidden='true'
                                >
                                    ▲
                                </span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default LiveDigitVisualizer;
