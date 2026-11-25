import OpenContract from '../OpenContract';

describe('open contract lifecycle', () => {
    it('treats an expired contract as closed even if is_sold is false', () => {
        const engine = new (OpenContract(class {}))();

        engine.setContractFlags({
            entry_tick: 1,
            is_expired: 1,
            is_sold: 0,
            is_valid_to_sell: 0,
            status: 'lost',
        });

        expect(engine.isSold).toBe(true);
    });
});
