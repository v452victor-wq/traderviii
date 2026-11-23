import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { buildMasterBotXml, FREE_BOT_TEMPLATES } from './bot-templates';
import './free-bots.scss';

const FreeBots = observer(() => {
    const { blockly_store, dashboard, load_modal, run_panel } = useStore();
    const { is_loading } = blockly_store;
    const { setActiveTab } = dashboard;
    const { is_running } = run_panel;
    const [loadingBotId, setLoadingBotId] = useState('');
    const [feedback, setFeedback] = useState('');
    const [feedbackIsError, setFeedbackIsError] = useState(false);
    const [consecutiveTicks, setConsecutiveTicks] = useState<Record<string, number>>(
        Object.fromEntries(FREE_BOT_TEMPLATES.map(bot => [bot.id, bot.defaultConsecutiveTicks]))
    );
    const [stake, setStake] = useState('1');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [martingale, setMartingale] = useState(false);
    const [martingaleMultiplier, setMartingaleMultiplier] = useState('2');
    const [tickDuration, setTickDuration] = useState('1');
    const [targetDigit, setTargetDigit] = useState('5');
    const [symbol, setSymbol] = useState('R_100');

    const loadBot = async (bot: (typeof FREE_BOT_TEMPLATES)[number]) => {
        const workspace = window.Blockly?.derivWorkspace;
        if (is_loading || !workspace) {
            setFeedback(localize('Bot Builder is still loading. Please try again in a moment.'));
            setFeedbackIsError(true);
            return;
        }
        if (is_running) {
            setFeedback(localize('Stop the running bot before loading another strategy.'));
            setFeedbackIsError(true);
            return;
        }
        if (!window.confirm(localize('Loading this free bot replaces the current Bot Builder workspace. Continue?'))) {
            return;
        }

        setLoadingBotId(bot.id);
        setFeedback('');
        setFeedbackIsError(false);
        const strategyId = `free-${bot.id}-${Date.now()}`;
        const xml = buildMasterBotXml(bot, {
            consecutiveTicks: consecutiveTicks[bot.id] ?? bot.defaultConsecutiveTicks,
            stake: Number(stake),
            stopLoss: Number(stopLoss),
            takeProfit: Number(takeProfit),
            martingale,
            martingaleMultiplier: Number(martingaleMultiplier),
            tickDuration: Number(tickDuration),
            symbol,
            targetDigit: Number(targetDigit),
        });

        try {
            const loaded = await load_modal.loadStrategyToBuilder(
                {
                    id: strategyId,
                    name: bot.name,
                    save_type: save_types.UNSAVED,
                    timestamp: Date.now(),
                    xml,
                },
                false
            );

            if (!loaded || workspace.current_strategy_id !== strategyId) {
                throw new Error(localize('The selected bot could not be loaded. Please try another template.'));
            }

            setActiveTab(DBOT_TABS.BOT_BUILDER);
        } catch (error) {
            setFeedback(
                error instanceof Error ? error.message : localize('The selected bot could not be loaded.')
            );
            setFeedbackIsError(true);
        } finally {
            setLoadingBotId('');
        }
    };

    const downloadBot = (bot: (typeof FREE_BOT_TEMPLATES)[number]) => {
        const xml = buildMasterBotXml(bot, {
            consecutiveTicks: consecutiveTicks[bot.id] ?? bot.defaultConsecutiveTicks,
            stake: Number(stake),
            stopLoss: Number(stopLoss),
            takeProfit: Number(takeProfit),
            martingale,
            martingaleMultiplier: Number(martingaleMultiplier),
            tickDuration: Number(tickDuration),
            symbol,
            targetDigit: Number(targetDigit),
        });
        const file = new Blob([xml], { type: 'application/xml' });
        const fileUrl = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `${bot.id}.xml`;
        link.click();
        URL.revokeObjectURL(fileUrl);
    };

    return (
        <main className='free-bots' aria-labelledby='free-bots-title'>
            <header className='free-bots__header'>
                <h1 id='free-bots-title'>
                    <Localize i18n_default_text='Free bots' />
                </h1>
                <p>
                    <Localize i18n_default_text='Choose a starter bot to load its Blockly XML into Bot Builder. Loading a bot does not start it.' />
                </p>
                <p className='free-bots__warning' role='note'>
                    <Localize i18n_default_text='These example strategies can lose money and do not guarantee profit. Review every block and test on a demo account before trading.' />
                </p>
            </header>

            <section className='free-bots__settings' aria-label={localize('Bot settings')}>
                <label>
                    {localize('Market')}
                    <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                        <option value='R_10'>Volatility 10 (1s)</option>
                        <option value='R_25'>Volatility 25</option>
                        <option value='R_50'>Volatility 50</option>
                        <option value='R_75'>Volatility 75</option>
                        <option value='R_100'>Volatility 100</option>
                        <option value='JD10'>Jump 10</option>
                        <option value='JD25'>Jump 25</option>
                        <option value='JD50'>Jump 50</option>
                        <option value='JD75'>Jump 75</option>
                        <option value='JD100'>Jump 100</option>
                    </select>
                </label>
                <label>{localize('Stake')}<input type='number' min='0.01' step='0.01' value={stake} onChange={e => setStake(e.target.value)} /></label>
                <label>{localize('Stop Loss')}<input type='number' min='0' step='0.01' value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label>
                <label>{localize('Take Profit')}<input type='number' min='0' step='0.01' value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label>
                <label>
                    {localize('Martingale')}
                    <select value={martingale ? 'on' : 'off'} onChange={e => setMartingale(e.target.value === 'on')}>
                        <option value='off'>{localize('Off')}</option>
                        <option value='on'>{localize('On')}</option>
                    </select>
                </label>
                {martingale && (
                    <label>{localize('Multiplier')}<input type='number' min='1.01' step='0.1' value={martingaleMultiplier} onChange={e => setMartingaleMultiplier(e.target.value)} /></label>
                )}
                <label>
                    {localize('Tick duration')}
                    <select value={tickDuration} onChange={e => setTickDuration(e.target.value)}>
                        {[1, 2, 3, 5, 10, 20, 50].map(ticks => (
                            <option key={ticks} value={ticks}>{ticks === 1 ? localize('1 Tick') : localize('{{ticks}} Ticks', { ticks })}</option>
                        ))}
                    </select>
                </label>
            </section>

            <div className='free-bots__grid'>
                {FREE_BOT_TEMPLATES.map(bot => (
                    <article className='free-bots__card' key={bot.id}>
                        <h2>{bot.name}</h2>
                        <p>{bot.description}</p>
                        <label className='free-bots__count'>
                            {localize('Consecutive tick entry count')}
                            <input
                                type='number'
                                min='1'
                                max='100'
                                value={consecutiveTicks[bot.id] ?? bot.defaultConsecutiveTicks}
                                onChange={event =>
                                    setConsecutiveTicks(current => ({
                                        ...current,
                                        [bot.id]: Math.max(1, Math.min(100, Number(event.target.value) || 1)),
                                    }))
                                }
                            />
                        </label>
                        {bot.contractType === 'DIGITDIFF' && (
                            <label className='free-bots__count'>
                                {localize('Entry digit and Differs target')}
                                <select value={targetDigit} onChange={event => setTargetDigit(event.target.value)}>
                                    {Array.from({ length: 10 }, (_, digit) => (
                                        <option key={digit} value={digit}>{digit}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className='free-bots__actions'>
                            <button
                                type='button'
                                className='free-bots__button'
                                onClick={() => loadBot(bot)}
                                disabled={is_loading || !!loadingBotId}
                            >
                                {loadingBotId === bot.id ? (
                                    <Localize i18n_default_text='Loading…' />
                                ) : (
                                    <Localize i18n_default_text='Load in Bot Builder' />
                                )}
                            </button>
                            <button
                                type='button'
                                className='free-bots__download'
                                onClick={() => downloadBot(bot)}
                            >
                                <Localize i18n_default_text='Download XML' />
                            </button>
                        </div>
                    </article>
                ))}
            </div>

            {feedback && (
                <p className={feedbackIsError ? 'free-bots__feedback free-bots__feedback--error' : 'free-bots__feedback'} role={feedbackIsError ? 'alert' : 'status'}>
                    {feedback}
                </p>
            )}
        </main>
    );
});

export default FreeBots;
