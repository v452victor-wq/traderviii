import { Localize } from '@deriv-com/translations';

const ContactChannels = () => (
    <details className='app-header__contact'>
        <summary aria-label='Contact us via WhatsApp or Telegram'>📞</summary>
        <div className='app-header__contact-menu'>
            <a href='https://whatsapp.com/channel/0029Vb8XQuN72WTpg2E5pt1U' target='_blank' rel='noreferrer'>
                <Localize i18n_default_text='WhatsApp' />
            </a>
            <a href='https://t.me/Pitanayo' target='_blank' rel='noreferrer'>
                <Localize i18n_default_text='Telegram' />
            </a>
        </div>
    </details>
);

export default ContactChannels;
