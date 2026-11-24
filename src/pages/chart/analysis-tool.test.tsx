import { act, render, waitFor } from '@testing-library/react';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import AnalysisTool from './analysis-tool';

jest.mock('@/external/bot-skeleton', () => ({
    api_base: {
        active_symbols: [
            {
                symbol: 'R_100',
                underlying_symbol: 'R_100',
                display_name: 'Volatility 100 Index',
                market: 'synthetic_index',
                pip_size: 2,
            },
        ],
    },
}));

jest.mock('@/external/bot-skeleton/services/api/chart-api', () => ({
    __esModule: true,
    default: { api: null },
}));

describe('AnalysisTool', () => {
    afterEach(() => {
        chart_api.api = null;
    });

    it('includes ticks received during history loading and updates cumulative live stats', async () => {
        let tickListener: ((message: unknown) => void) | undefined;
        let resolveHistory: ((response: unknown) => void) | undefined;
        const api = {
            send: jest.fn((request: { ticks_history?: string }) =>
                request.ticks_history
                    ? new Promise<unknown>(resolve => {
                          resolveHistory = resolve;
                      })
                    : Promise.resolve({})
            ),
            onMessage: jest.fn(() => ({
                subscribe: (listener: (message: unknown) => void) => {
                    tickListener = listener;
                    return { unsubscribe: jest.fn() };
                },
            })),
        };
        chart_api.api = api;

        const { container } = render(<AnalysisTool />);
        expect(tickListener).toBeDefined();

        act(() => {
            tickListener?.({
                data: { msg_type: 'tick', tick: { symbol: 'R_100', quote: 15.92, pip_size: 2 } },
            });
        });

        await act(async () => {
            resolveHistory?.({
                history: { prices: [12.31, 13.31, 14.39] },
                pip_size: 2,
                subscription: { id: 'ticks-subscription' },
            });
            await Promise.resolve();
        });

        const stats = container.querySelectorAll('.analysis-tool__stats strong');
        await waitFor(() => expect(stats[0].textContent).toBe('4'));
        let items = container.querySelectorAll('.live-digit-visualizer__item');
        expect(items[2]).toHaveClass('live-digit-visualizer__item--active');
        expect(items[2].querySelector('small')?.textContent).toBe('25.0%');

        act(() => {
            tickListener?.({
                data: { msg_type: 'tick', tick: { symbol: 'R_100', quote: 16.91, pip_size: 2 } },
            });
        });
        act(() => {
            tickListener?.({
                data: { msg_type: 'tick', tick: { symbol: 'OTHER', quote: 18.88, pip_size: 2 } },
            });
        });

        await waitFor(() => expect(stats[0].textContent).toBe('5'));
        items = container.querySelectorAll('.live-digit-visualizer__item');
        expect(items[1]).toHaveClass('live-digit-visualizer__item--active');
        expect(items[1].querySelector('small')?.textContent).toBe('60.0%');
        expect(items[1].querySelector('.live-digit-visualizer__pointer')).toHaveClass(
            'live-digit-visualizer__pointer--pulse-even'
        );

        act(() => {
            tickListener?.({
                data: { msg_type: 'tick', tick: { symbol: 'R_100', quote: 16.21, pip_size: 2 } },
            });
        });

        await waitFor(() => expect(stats[0].textContent).toBe('6'));
        items = container.querySelectorAll('.live-digit-visualizer__item');
        expect(items[1]).toHaveClass('live-digit-visualizer__item--active');
        expect(items[1].querySelector('small')?.textContent).toBe('66.7%');
        expect(items[1].querySelector('.live-digit-visualizer__pointer')).toHaveClass(
            'live-digit-visualizer__pointer--pulse-odd'
        );
    });
});
