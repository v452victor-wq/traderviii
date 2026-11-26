import { readFileSync } from 'fs';
import { setFireStrategyStake } from './fire-strategy';

const fireStrategyXml = readFileSync(
    `${process.cwd()}/public/strategies/over-2-fire-and-under-7-fire.xml`,
    'utf8'
);
const strategyXml = `
<xml>
  <block type="trade_definition_tradeoptions">
    <value name="AMOUNT"><block type="math_number" id="flat_stake"><field name="NUM">0.35</field></block></value>
    <value name="DURATION"><block type="math_number"><field name="NUM">1</field></block></value>
  </block>
</xml>`;

describe('Over 2 Fire strategy settings', () => {
    it('ships with complete recovery and fixed risk settings', () => {
        const document = new DOMParser().parseFromString(fireStrategyXml, 'application/xml');
        const purchases = Array.from(document.querySelectorAll('field[name="PURCHASE_LIST"]')).map(
            field => field.textContent
        );

        expect(document.querySelector('block[type="trade_definition"] mutation')?.getAttribute('allow_all_digit_contracts')).toBe('true');
        expect(document.querySelector('block[id="flat_stake"] field[name="NUM"]')?.textContent).toBe('0.35');
        expect(document.querySelector('block[id="sixth_from_end"] field[name="NUM"]')?.textContent).toBe('6');
        expect(purchases).toEqual(expect.arrayContaining(['DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD']));
        expect(document.querySelector('block[id="check_last_loss"] field[name="CHECK_RESULT"]')?.textContent).toBe('loss');
        expect(document.querySelector('block[id="enter_recovery_after_loss"] field[name="BOOL"]')?.textContent).toBe('TRUE');
        expect(document.querySelector('block[id="three_loss_limit"] field[name="NUM"]')?.textContent).toBe('3');
        expect(document.querySelector('block[id="stop_loss_limit"] field[name="NUM"]')?.textContent).toBe('-5');
        expect(document.querySelector('block[id="take_profit_limit"] field[name="NUM"]')?.textContent).toBe('5');
        expect(document.querySelector('block[type="math_arithmetic"]')).toBeNull();
    });

    it('changes only the flat stake amount', () => {
        const document = new DOMParser().parseFromString(setFireStrategyStake(strategyXml, '1.25'), 'application/xml');

        expect(document.querySelector('block[id="flat_stake"] field[name="NUM"]')?.textContent).toBe('1.25');
        expect(document.querySelector('value[name="DURATION"] field[name="NUM"]')?.textContent).toBe('1');
    });

    it('rejects invalid stakes and malformed strategy XML', () => {
        expect(() => setFireStrategyStake(strategyXml, '0')).toThrow('at least 0.01');
        expect(() => setFireStrategyStake('<xml>', 0.35)).toThrow('file is invalid');
    });
});
