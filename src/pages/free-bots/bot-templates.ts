export type MasterBotSettings = {
    consecutiveTicks: number;
    stake: number;
    stopLoss: number;
    takeProfit: number;
    martingale: boolean;
    martingaleMultiplier: number;
    tickDuration: number;
    symbol: string;
    targetDigit?: number;
};

export type MasterBotTemplate = {
    id: string;
    name: string;
    description: string;
    contractType: 'DIGITODD' | 'DIGITEVEN' | 'DIGITUNDER' | 'DIGITOVER' | 'DIGITDIFF';
    defaultConsecutiveTicks: number;
    xml: string;
};

const escapeXml = (value: string | number) =>
    String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const buildMasterBotXml = (
    bot: Omit<MasterBotTemplate, 'xml'>,
    settings: MasterBotSettings
) => {
    const count = Math.max(1, Math.min(100, Math.floor(settings.consecutiveTicks)));
    const ticks = Math.max(1, Math.min(50, Math.floor(settings.tickDuration)));
    const stake = Math.max(0.01, Number(settings.stake) || 1);
    const barrier = settings.targetDigit ?? 5;
    const predictionBlock =
        bot.contractType === 'DIGITUNDER' || bot.contractType === 'DIGITOVER' ||
        bot.contractType === 'DIGITDIFF'
            ? `<value name="PREDICTION"><block type="math_number"><field name="NUM">${barrier}</field></block></value>`
            : '';

    return `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables>
    <variable type="" id="consecutive_ticks" islocal="false" iscloud="false">master_bot:consecutive_ticks</variable>
    <variable type="" id="initial_stake" islocal="false" iscloud="false">master_bot:initial_stake</variable>
  </variables>
  <block type="trade" id="master_trade" x="0" y="0">
    <statement name="SUBMARKET">
      <block type="market" id="master_market">
        <field name="MARKET_LIST">volidx</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${escapeXml(settings.symbol)}</field>
        <field name="TRADETYPECAT_LIST">digits</field>
        <field name="TRADETYPE_LIST">${bot.contractType === 'DIGITDIFF' ? 'matchesdiffers' : 'digits'}</field>
        <field name="TYPE_LIST">both</field>
        <field name="CANDLEINTERVAL_LIST">60</field>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="PAYOUTTYPE_LIST">stake</field>
        <field name="CURRENCY_LIST">USD</field>
        <field name="RESTARTONERROR">TRUE</field>
        <value name="DURATION"><block type="math_number"><field name="NUM">${ticks}</field></block></value>
        <value name="AMOUNT"><block type="math_number"><field name="NUM">${stake}</field></block></value>
        ${predictionBlock}
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="master_before" x="0" y="268">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="variables_set" id="master_count">
        <field name="VAR" id="consecutive_ticks" variabletype="">master_bot:consecutive_ticks</field>
        <value name="VALUE"><block type="math_number"><field name="NUM">${count}</field></block></value>
        <next>
          <block type="purchase" id="master_purchase">
            <field name="PURCHASE_LIST">${bot.contractType}</field>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="master_after" x="0" y="446">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again" id="master_again"></block>
    </statement>
  </block>
  <metadata>
    <bot_name>${escapeXml(bot.name)}</bot_name>
    <consecutive_ticks>${count}</consecutive_ticks>
    <stop_loss>${Math.max(0, Number(settings.stopLoss) || 0)}</stop_loss>
    <take_profit>${Math.max(0, Number(settings.takeProfit) || 0)}</take_profit>
    <martingale>${settings.martingale ? 'true' : 'false'}</martingale>
    <martingale_multiplier>${Math.max(1.01, Number(settings.martingaleMultiplier) || 2)}</martingale_multiplier>
  </metadata>
</xml>`;
};

const definitions: Array<Omit<MasterBotTemplate, 'xml'>> = [
    {
        id: 'odd-master',
        name: 'Odd Master Bot',
        description: 'Waits for the configured consecutive Even digits, then enters an Odd contract.',
        contractType: 'DIGITODD',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'even-master',
        name: 'Even Master Bot',
        description: 'Waits for the configured consecutive Odd digits, then enters an Even contract.',
        contractType: 'DIGITEVEN',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'wakisasa-under',
        name: 'Wakisasa Bot (Under)',
        description: 'Waits for consecutive Over digits, then enters an Under contract.',
        contractType: 'DIGITUNDER',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'over-master',
        name: 'Over Master Bot',
        description: 'Waits for consecutive Under digits, then enters an Over contract.',
        contractType: 'DIGITOVER',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'digit-streak-differs',
        name: 'Digit Streak / Differs Master Bot',
        description: 'Uses a configurable consecutive-digit sequence or streak condition, then enters Differs.',
        contractType: 'DIGITDIFF',
        defaultConsecutiveTicks: 5,
    },
];

export const FREE_BOT_TEMPLATES: ReadonlyArray<MasterBotTemplate> = definitions.map(bot => {
    const xml = buildMasterBotXml(bot, {
        consecutiveTicks: bot.defaultConsecutiveTicks,
        stake: 1,
        stopLoss: 0,
        takeProfit: 0,
        martingale: false,
        martingaleMultiplier: 2,
        tickDuration: 1,
        symbol: 'R_100',
    });
    return { ...bot, xml };
});
