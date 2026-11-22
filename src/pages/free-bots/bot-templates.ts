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
    const ticks = Math.max(1, Math.min(50, Math.floor(settings.tickDuration)));
    const stake = Math.max(0.01, Number(settings.stake) || 1);
    const barrier = settings.targetDigit ?? 5;
    const hasPrediction =
        bot.contractType === 'DIGITUNDER' ||
        bot.contractType === 'DIGITOVER' ||
        bot.contractType === 'DIGITDIFF';
    const tradeType =
        bot.contractType === 'DIGITODD' || bot.contractType === 'DIGITEVEN'
            ? 'evenodd'
            : bot.contractType === 'DIGITUNDER' || bot.contractType === 'DIGITOVER'
              ? 'overunder'
              : 'matchesdiffers';
    const predictionBlock = hasPrediction
        ? `<value name="PREDICTION"><block type="math_number"><field name="NUM">${barrier}</field></block></value>`
        : '';

    return `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <block type="trade_definition" id="master_trade" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="master_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${escapeXml(settings.symbol)}</field>
        <next>
          <block type="trade_definition_tradetype" id="master_trade_type">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" id="master_contract_type">
                <field name="TYPE_LIST">${bot.contractType}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="master_candle_interval">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="master_restart_buy_sell">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="master_restart_on_error">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="master_trade_options">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${hasPrediction}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION"><block type="math_number"><field name="NUM">${ticks}</field></block></value>
        <value name="AMOUNT"><block type="math_number"><field name="NUM">${stake}</field></block></value>
        ${predictionBlock}
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="master_before" x="0" y="268">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="master_purchase">
        <field name="PURCHASE_LIST">${bot.contractType}</field>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="master_after" x="0" y="446">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again" id="master_again"></block>
    </statement>
  </block>
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
