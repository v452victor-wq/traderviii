import { FREE_BOT_TEMPLATES } from './bot-templates';

describe('free bot templates', () => {
    it('provides five valid Blockly XML strategies', () => {
        expect(FREE_BOT_TEMPLATES).toHaveLength(5);

        FREE_BOT_TEMPLATES.forEach(({ xml }) => {
            const document = new DOMParser().parseFromString(xml, 'application/xml');

            expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
            expect(document.querySelector('xml block')).not.toBeNull();
        });
    });
});
