import { buildDigitProposalRequest, getDigitDistribution, getLastDigit } from './digit-analysis';

describe('getDigitDistribution', () => {
    it('counts last digits using the symbol precision, including trailing zeroes', () => {
        const distribution = getDigitDistribution([12.3, 5.67, 8], 2);

        expect(distribution.map(({ count }) => count)).toEqual([2, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
    });

    it('returns zero counts for an empty history', () => {
        expect(getDigitDistribution([], 2).every(({ count }) => count === 0)).toBe(true);
    });
});

describe('getLastDigit', () => {
    it('uses the symbol precision and rejects invalid prices', () => {
        expect(getLastDigit(12.3, 2)).toBe(0);
        expect(getLastDigit(5.67, 2)).toBe(7);
        expect(getLastDigit('invalid', 2)).toBeNull();
    });
});

describe('buildDigitProposalRequest', () => {
    const baseRequest = {
        amount: 1,
        barrier: 5,
        contractType: 'DIGITOVER' as const,
        currency: 'USD',
        duration: 2,
        symbol: 'R_50',
    };

    it('includes the prediction barrier for digit contracts that require one', () => {
        expect(buildDigitProposalRequest(baseRequest)).toMatchObject({
            contract_type: 'DIGITOVER',
            barrier: 5,
            duration_unit: 't',
            underlying_symbol: 'R_50',
        });
    });

    it('omits a barrier for even and odd contracts', () => {
        const request = buildDigitProposalRequest({ ...baseRequest, contractType: 'DIGITEVEN' });

        expect(request).not.toHaveProperty('barrier');
    });
});
