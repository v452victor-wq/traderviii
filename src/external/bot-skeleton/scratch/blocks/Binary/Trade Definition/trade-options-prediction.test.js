import { getTradeOptionsPrediction } from './trade-options-prediction';

describe('trade options prediction', () => {
    it('does not attach a prediction to contracts without a prediction input', () => {
        expect(getTradeOptionsPrediction(false)).toBeUndefined();
    });

    it('preserves an explicit Over/Under prediction', () => {
        expect(getTradeOptionsPrediction(true, '7')).toBe('7');
    });

    it('uses the existing fallback only when a prediction input is present but empty', () => {
        expect(getTradeOptionsPrediction(true, '')).toBe('-1');
    });
});
