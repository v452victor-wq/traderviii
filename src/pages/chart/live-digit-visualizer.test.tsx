import { render } from '@testing-library/react';
import LiveDigitVisualizer from './live-digit-visualizer';

describe('LiveDigitVisualizer', () => {
    it('highlights highest and lowest percentages and follows the latest digit', () => {
        const { container, rerender } = render(
            <LiveDigitVisualizer prices={[12.31, 13.31, 14.39]} pipSize={2} />
        );
        let items = container.querySelectorAll('.live-digit-visualizer__item');
        const rows = container.querySelectorAll('.live-digit-visualizer__row');

        expect(items).toHaveLength(10);
        expect(rows).toHaveLength(2);
        expect(
            Array.from(rows, row =>
                Array.from(row.querySelectorAll('strong'), digit => digit.textContent)
            )
        ).toEqual([['0', '1', '2', '3', '4'], ['5', '6', '7', '8', '9']]);
        expect(items[1]).toHaveClass('live-digit-visualizer__item--high');
        expect(items[0]).toHaveClass('live-digit-visualizer__item--low');
        expect(items[9]).toHaveClass('live-digit-visualizer__item--active');
        expect(items[9].children[0]).toHaveClass('live-digit-visualizer__circle');
        expect(items[9].children[1]).toHaveClass('live-digit-visualizer__pointer');

        rerender(<LiveDigitVisualizer prices={[12.31, 13.31, 14.39, 15.92]} pipSize={2} />);
        items = container.querySelectorAll('.live-digit-visualizer__item');

        expect(items[9]).not.toHaveClass('live-digit-visualizer__item--active');
        expect(items[2]).toHaveClass('live-digit-visualizer__item--active');
    });
});
