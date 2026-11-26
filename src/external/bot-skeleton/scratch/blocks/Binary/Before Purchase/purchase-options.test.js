import { getInitialPurchaseOptions } from './purchase-options';

describe('initial purchase dropdown options', () => {
    it('accepts every contract type while Blockly imports strategy XML', () => {
        const values = getInitialPurchaseOptions().map(([, value]) => value);

        expect(values).toEqual(
            expect.arrayContaining(['CALL', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD'])
        );
        expect(new Set(values).size).toBe(values.length);
    });
});
