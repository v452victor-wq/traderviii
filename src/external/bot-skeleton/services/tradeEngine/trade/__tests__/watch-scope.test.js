import TradeEngine from '../../trade';
import { OPEN_CONTRACT } from '../../trade/state/constants';
import { sell } from '../../trade/state/actions';

describe('trade scope watchers', () => {
    it('wakes on contract closure without waiting for another tick', async () => {
        const engine = new TradeEngine({ observer: {} });
        engine.store.dispatch({ type: OPEN_CONTRACT });

        const result = engine.watch('during');
        engine.store.dispatch(sell());

        const timedResult = await Promise.race([
            result,
            new Promise(resolve => setTimeout(() => resolve('timed out'), 0)),
        ]);

        expect(timedResult).toBe(false);
    });
});
