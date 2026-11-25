import { fireEvent, render, screen } from '@testing-library/react';
import ContactChannels from '../contact-channels';

describe('ContactChannels', () => {
    it('opens WhatsApp and Telegram links from the phone menu', () => {
        const { container } = render(<ContactChannels />);

        fireEvent.click(screen.getByText('📞'));

        expect(container.querySelector('details')).toHaveAttribute('open');
        expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
            'href',
            'https://whatsapp.com/channel/0029Vb8XQuN72WTpg2E5pt1U'
        );
        expect(screen.getByRole('link', { name: 'Telegram' })).toHaveAttribute('href', 'https://t.me/Pitanayo');
        expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('target', '_blank');
        expect(screen.getByRole('link', { name: 'Telegram' })).toHaveAttribute('rel', 'noreferrer');
    });
});
