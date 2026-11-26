import { tradeOptionToBuy } from '../helpers';

describe('tradeOptionToBuy', () => {
    const options = {
        amount: 0.35,
        basis: 'stake',
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
        symbol: '1HZ100V',
    };

    it.each([
        ['DIGITOVER', 2],
        ['DIGITUNDER', 7],
    ])('applies the selected barrier to %s', (contractType, prediction) => {
        const buy = tradeOptionToBuy(contractType, { ...options, prediction });

        expect(buy.parameters).toMatchObject({
            contract_type: contractType,
            barrier: prediction,
            selected_tick: prediction,
        });
    });

    it('does not add a barrier when purchasing an even/odd recovery contract', () => {
        const buy = tradeOptionToBuy('DIGITEVEN', options);

        expect(buy.parameters).not.toHaveProperty('barrier');
        expect(buy.parameters).not.toHaveProperty('selected_tick');
    });
});
