import getBotInterface from '../BotInterface';

describe('bot contract results', () => {
    it('forwards a per-purchase prediction to the trade engine', () => {
        const purchase = jest.fn();
        const bot = getBotInterface({
            data: { contract: {} },
            getPurchaseReference: () => undefined,
            purchase,
        });

        bot.purchase('DIGITUNDER', 7);

        expect(purchase).toHaveBeenCalledWith('DIGITUNDER', 7);
    });

    it('uses the closed contract status and payout for Blockly result checks', () => {
        const bot = getBotInterface({
            data: {
                contract: {
                    buy_price: 1,
                    currency: 'USD',
                    profit: 2,
                    sell_price: 3,
                    status: 'lost',
                    transaction_ids: { buy: 1 },
                },
            },
            getPurchaseReference: () => undefined,
        });

        expect(bot.isResult('win')).toBe(false);
        expect(bot.isResult('loss')).toBe(true);
    });

    it('does not report a result while the contract is still open', () => {
        const bot = getBotInterface({
            data: {
                contract: {
                    buy_price: 1,
                    currency: 'USD',
                    profit: 2,
                    sell_price: 3,
                    status: 'open',
                    transaction_ids: { buy: 1 },
                },
            },
            getPurchaseReference: () => undefined,
        });

        expect(bot.isResult('win')).toBe(false);
        expect(bot.isResult('loss')).toBe(false);
    });
});
