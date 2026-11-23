import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { getDigitDistribution, getLastDigit } from './digit-analysis';

type LiveDigitVisualizerProps = {
    prices: Array<number | string>;
    pipSize: number;
    tickSequence?: number;
};

const LiveDigitVisualizer = ({ prices, pipSize, tickSequence = 0 }: LiveDigitVisualizerProps) => {
    const distribution = useMemo(() => getDigitDistribution(prices, pipSize), [prices, pipSize]);
    const total = distribution.reduce((sum, { count }) => sum + count, 0);
    const highest = total ? Math.max(...distribution.map(({ count }) => count)) : 0;
    const lowest = total ? Math.min(...distribution.map(({ count }) => count)) : 0;
    const latestDigit = useMemo(
        () => (prices.length ? getLastDigit(prices[prices.length - 1], pipSize) : null),
        [prices, pipSize]
    );

    return (
        <div className='live-digit-visualizer' aria-label='Live last digit frequency'>
            <div className='live-digit-visualizer__row'>
                {distribution.map(({ digit, count }) => {
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
                            style={
                                {
                                    '--digit-angle': `${digit * 36}deg`,
                                    '--digit-counter-angle': `${digit * -36}deg`,
                                } as CSSProperties
                            }
                        >
                            <span className='live-digit-visualizer__circle'>
                                <strong>{digit}</strong>
                                <small>{percentage.toFixed(1)}%</small>
                            </span>
                            <span
                                className='live-digit-visualizer__pointer'
                                key={`${digit}-${tickSequence}`}
                                aria-hidden='true'
                            >
                                ▲
                            </span>
                        </div>
                    );
                })}
            </div>
            <span className='live-digit-visualizer__center' aria-hidden='true'>
                LIVE
                <br />
                DIGITS
            </span>
        </div>
    );
};

export default LiveDigitVisualizer;
