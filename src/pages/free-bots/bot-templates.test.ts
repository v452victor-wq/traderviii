import { buildMasterBotXml, FREE_BOT_TEMPLATES } from './bot-templates';

describe('free bot templates', () => {
    it('provides five valid Blockly XML strategies', () => {
        expect(FREE_BOT_TEMPLATES).toHaveLength(5);

        FREE_BOT_TEMPLATES.forEach(({ xml }) => {
            const document = new DOMParser().parseFromString(xml, 'application/xml');
            const blockTypes = Array.from(document.querySelectorAll('block')).map(block =>
                block.getAttribute('type')
            );
            const supportedBlockTypes = new Set([
                'trade_definition',
                'trade_definition_market',
                'trade_definition_tradetype',
                'trade_definition_contracttype',
                'trade_definition_candleinterval',
                'trade_definition_restartbuysell',
                'trade_definition_restartonerror',
                'trade_definition_tradeoptions',
                'math_number',
                'math_change',
                'math_modulo',
                'math_arithmetic',
                'variables_get',
                'variables_set',
                'last_digit',
                'logic_compare',
                'controls_if',
                'contract_check_result',
                'before_purchase',
                'purchase',
                'after_purchase',
                'trade_again',
            ]);

            expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
            expect(blockTypes).toContain('trade_definition');
            expect(document.querySelector('field[name="MARKET_LIST"]')?.textContent).toBe('volidx');
            expect(blockTypes).toContain('math_change');
            expect(blockTypes).toContain('last_digit');
            expect(blockTypes).toContain('controls_if');
            expect(blockTypes.every(type => supportedBlockTypes.has(type ?? ''))).toBe(true);
            expect(document.querySelector('metadata')).toBeNull();
        });
    });

    it('includes configured trade, streak, stop, take-profit, and martingale values', () => {
        const { xml: _templateXml, ...bot } = FREE_BOT_TEMPLATES[4];
        const xml = buildMasterBotXml(bot, {
            consecutiveTicks: 7,
            stake: 2.5,
            stopLoss: 12,
            takeProfit: 24,
            martingale: true,
            martingaleMultiplier: 1.3,
            tickDuration: 2,
            symbol: 'R_75',
            targetDigit: 7,
        });
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const fields = Array.from(document.querySelectorAll('field[name="NUM"]')).map(field => field.textContent);

        expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(document.querySelector('field[name="SYMBOL_LIST"]')?.textContent).toBe('R_75');
        expect(document.querySelector('field[name="TYPE_LIST"]')?.textContent).toBe('DIGITDIFF');
        expect(fields).toEqual(expect.arrayContaining(['7', '2.5', '2', '-12', '24', '1.3']));
        expect(document.querySelectorAll('block[type="math_change"]')).toHaveLength(1);
        expect(document.querySelectorAll('block[type="total_profit"]')).toHaveLength(2);
        expect(document.querySelectorAll('block[type="math_arithmetic"]')).toHaveLength(1);
        expect(xml).toContain('Entry streak');
        expect(xml).toContain('Current stake');
    });

    it('keeps Wakisasa explicitly named and waits for configured Over digits before Under', () => {
        const wakisasa = FREE_BOT_TEMPLATES.find(bot => bot.id === 'wakisasa-under');
        expect(wakisasa?.name).toBe('Wakisasa Bot');
        if (!wakisasa) throw new Error('Wakisasa template is missing.');

        const { xml: _templateXml, ...bot } = wakisasa;
        const xml = buildMasterBotXml(bot, {
            consecutiveTicks: 5,
            stake: 1,
            stopLoss: 10,
            takeProfit: 20,
            martingale: false,
            martingaleMultiplier: 2,
            tickDuration: 2,
            symbol: 'R_100',
            targetDigit: 6,
        });
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const entryCondition = document.querySelector(
            'block[type="before_purchase"] block[type="controls_if"] > value[name="IF0"]'
        );

        expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(document.querySelector('field[name="TYPE_LIST"]')?.textContent).toBe('DIGITUNDER');
        expect(document.querySelector('field[name="PURCHASE_LIST"]')?.textContent).toBe('DIGITUNDER');
        expect(entryCondition?.querySelector('field[name="OP"]')?.textContent).toBe('GT');
        expect(entryCondition?.querySelector('field[name="NUM"]')?.textContent).toBe('6');
        expect(document.querySelector('field[name="DURATIONTYPE_LIST"]')?.textContent).toBe('t');
        expect(document.querySelector('field[name="NUM"]')?.textContent).toBe('0');
        expect(xml).toContain('NUM">5</field>');
    });
});
