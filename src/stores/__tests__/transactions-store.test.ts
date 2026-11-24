import { getStoredItemsByKey, getStoredItemsByUser, setStoredItemsByKey } from '../../utils/session-storage';
import TransactionsStore from '../transactions-store';
import { TContractInfo } from '../../components/summary/summary-card.types';

jest.mock('../../utils/session-storage', () => ({
    getStoredItemsByKey: jest.fn(() => ({})),
    getStoredItemsByUser: jest.fn(() => ({})),
    setStoredItemsByKey: jest.fn(),
}));

jest.mock('@/external/bot-skeleton', () => ({
    LogTypes: {},
}));

describe('TransactionsStore persistence', () => {
    it('persists new and completed contracts but skips in-progress tick updates', () => {
        const store = new TransactionsStore(
            { run_panel: { run_id: 'run-1' } } as never,
            { client: { loginid: 'CR123' } } as never
        );
        const contract = {
            contract_id: 123,
            date_start: 1,
            buy_price: 1,
            status: 'open' as const,
            transaction_ids: { buy: 456 },
        } as TContractInfo;

        store.onBotContractEvent(contract);
        store.onBotContractEvent({ ...contract, bid_price: 0.9 });
        expect(setStoredItemsByKey).toHaveBeenCalledTimes(1);

        store.onBotContractEvent({
            ...contract,
            status: 'won',
            is_sold: 1,
            profit: 1,
            sell_price: 2,
        });
        expect(setStoredItemsByKey).toHaveBeenCalledTimes(2);

        store.disposeReactionsFn();
        expect(getStoredItemsByKey).toHaveBeenCalledWith('transaction_cache', {});
        expect(getStoredItemsByUser).toHaveBeenCalled();
    });
});
