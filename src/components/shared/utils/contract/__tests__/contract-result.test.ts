import { getContractProfit, getDisplayStatus, isContractWon, TContractInfo } from '..';

const createContract = (overrides: Partial<TContractInfo> = {}) =>
    ({
        buy_price: 1,
        contract_type: 'CALL',
        profit: 1,
        sell_price: 2,
        status: 'sold',
        ...overrides,
    }) as TContractInfo;

describe('contract result classification', () => {
    it('classifies a positive-profit contract with credited payout as won', () => {
        expect(isContractWon(createContract())).toBe(true);
        expect(getDisplayStatus(createContract())).toBe('won');
    });

    it('classifies zero payout as lost even when reported profit is positive', () => {
        const contract = createContract({ profit: 1, sell_price: 0 });

        expect(isContractWon(contract)).toBe(false);
        expect(getContractProfit(contract)).toBe(-1);
        expect(getDisplayStatus(contract)).toBe('lost');
    });

    it('does not treat an indicative bid price as credited payout', () => {
        expect(isContractWon(createContract({ payout: undefined, sell_price: undefined, bid_price: 5 }))).toBe(false);
    });

    it('classifies zero profit as lost', () => {
        expect(isContractWon(createContract({ profit: 0 }))).toBe(false);
    });

    it('derives profit from payout and stake when reported profit is missing', () => {
        expect(isContractWon(createContract({ profit: undefined }))).toBe(true);
        expect(isContractWon(createContract({ profit: undefined, sell_price: 1 }))).toBe(false);
    });
});
