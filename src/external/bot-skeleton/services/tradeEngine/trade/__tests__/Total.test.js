import Total from '../Total';

describe('trade totals', () => {
    it('records a closed loss and its stake without interrupting contract completion', () => {
        const accountId = `totals-test-${Date.now()}`;
        const engine = new (Total(class {}))();
        engine.accountInfo = { loginid: accountId };

        expect(() =>
            engine.updateTotals({
                buy_price: 5,
                currency: 'USD',
                payout: 0,
                profit: -5,
                sell_price: 0,
                status: 'lost',
            })
        ).not.toThrow();

        expect(engine.getAccountStat()).toMatchObject({
            totalLosses: 1,
            totalPayout: 0,
            totalProfit: -5,
            totalStake: 5,
            totalWins: 0,
        });
    });
});
