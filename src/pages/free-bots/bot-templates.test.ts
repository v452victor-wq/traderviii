import { FREE_BOT_TEMPLATES } from './bot-templates';

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
                'before_purchase',
                'purchase',
                'after_purchase',
                'trade_again',
            ]);

            expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
            expect(blockTypes).toContain('trade_definition');
            expect(blockTypes.every(type => supportedBlockTypes.has(type ?? ''))).toBe(true);
            expect(document.querySelector('metadata')).toBeNull();
        });
    });
});
