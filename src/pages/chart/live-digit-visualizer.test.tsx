import { render } from '@testing-library/react';
import LiveDigitVisualizer from './live-digit-visualizer';

describe('LiveDigitVisualizer', () => {
    it('highlights highest and lowest percentages and follows the latest digit', () => {
        const { container, rerender } = render(
            <LiveDigitVisualizer prices={[12.31, 13.31, 14.39]} pipSize={2} />
        );
        let items = container.querySelectorAll('.live-digit-visualizer__item');

        expect(items[1]).toHaveClass('live-digit-visualizer__item--high');
        expect(items[0]).toHaveClass('live-digit-visualizer__item--low');
        expect(items[9]).toHaveClass('live-digit-visualizer__item--active');

        rerender(<LiveDigitVisualizer prices={[12.31, 13.31, 14.39, 15.92]} pipSize={2} />);
        items = container.querySelectorAll('.live-digit-visualizer__item');

        expect(items[9]).not.toHaveClass('live-digit-visualizer__item--active');
        expect(items[2]).toHaveClass('live-digit-visualizer__item--active');
    });
});
