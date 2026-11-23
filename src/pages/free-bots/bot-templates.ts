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
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const getEntryCondition = (contractType: MasterBotTemplate['contractType'], barrier: number) => {
    const lastDigit = '<block type="last_digit" />';
    const number = (value: number) => `<block type="math_number"><field name="NUM">${value}</field></block>`;
    const compare = (operator: string, left: string, right: string) =>
        `<block type="logic_compare"><field name="OP">${operator}</field><value name="A">${left}</value><value name="B">${right}</value></block>`;

    switch (contractType) {
        case 'DIGITODD':
        case 'DIGITEVEN': {
            const parity = contractType === 'DIGITODD' ? 0 : 1;
            const modulo =
                `<block type="math_modulo"><value name="DIVIDEND">${lastDigit}</value>` +
                `<value name="DIVISOR">${number(2)}</value></block>`;
            return compare('EQ', modulo, number(parity));
        }
        case 'DIGITUNDER':
            return compare('GT', lastDigit, number(barrier));
        case 'DIGITOVER':
            return compare('LT', lastDigit, number(barrier));
        case 'DIGITDIFF':
            return compare('EQ', lastDigit, number(barrier));
    }
};

export const buildMasterBotXml = (bot: Omit<MasterBotTemplate, 'xml'>, settings: MasterBotSettings) => {
    let id = 0;
    const nextId = () => `master_${id++}`;
    const safeTicks = Math.max(1, Math.min(100, Math.floor(Number(settings.consecutiveTicks) || 1)));
    const tickDuration = Math.max(1, Math.min(100, Math.floor(Number(settings.tickDuration) || 1)));
    const stake = Math.max(0.01, Number(settings.stake) || 1);
    const stopLoss = Math.max(0, Number(settings.stopLoss) || 0);
    const takeProfit = Math.max(0, Number(settings.takeProfit) || 0);
    const multiplier = Math.max(1.01, Number(settings.martingaleMultiplier) || 2);
    const barrier = Math.max(0, Math.min(9, Math.floor(settings.targetDigit ?? 5)));
    const symbol = escapeXml(settings.symbol);
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
    const number = (value: number) =>
        `<block type="math_number" id="${nextId()}"><field name="NUM">${value}</field></block>`;
    const variableGet = (name: string) =>
        `<block type="variables_get" id="${nextId()}"><field name="VAR">${escapeXml(name)}</field></block>`;
    const variableSet = (name: string, value: string, next = '') =>
        `<block type="variables_set" id="${nextId()}"><field name="VAR">${escapeXml(name)}</field>` +
        `<value name="VALUE">${value}</value>${next ? `<next>${next}</next>` : ''}</block>`;
    const compare = (operator: string, left: string, right: string) =>
        `<block type="logic_compare" id="${nextId()}"><field name="OP">${operator}</field>` +
        `<value name="A">${left}</value><value name="B">${right}</value></block>`;
    const ifThen = (condition: string, statement: string) =>
        `<block type="controls_if" id="${nextId()}"><value name="IF0">${condition}</value>` +
        `<statement name="DO0">${statement}</statement></block>`;
    const ifElse = (condition: string, whenTrue: string, whenFalse: string, next = '') =>
        `<block type="controls_if" id="${nextId()}"><mutation else="1"></mutation>` +
        `<value name="IF0">${condition}</value><statement name="DO0">${whenTrue}</statement>` +
        `<statement name="ELSE">${whenFalse}</statement>${next ? `<next>${next}</next>` : ''}</block>`;

    const incrementStreak =
        `<block type="math_change" id="${nextId()}"><field name="VAR">Entry streak</field>` +
        `<value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>`;
    const resetStreak = variableSet('Entry streak', number(0));
    const enterWhenReady = ifThen(
        compare('GTE', variableGet('Entry streak'), number(safeTicks)),
        `<block type="purchase" id="${nextId()}"><field name="PURCHASE_LIST">${bot.contractType}</field></block>`
    );
    const updateStreak =
        `<block type="controls_if" id="${nextId()}"><mutation else="1"></mutation>` +
        `<value name="IF0">${getEntryCondition(bot.contractType, barrier)}</value>` +
        `<statement name="DO0">${incrementStreak}</statement>` +
        `<statement name="ELSE">${resetStreak}</statement>` +
        `<next>${enterWhenReady}</next></block>`;

    let continueTrading = `<block type="trade_again" id="${nextId()}"></block>`;
    if (takeProfit > 0) {
        continueTrading = ifThen(
            compare('LT', '<block type="total_profit" />', number(takeProfit)),
            continueTrading
        );
    }
    if (stopLoss > 0) {
        continueTrading = ifThen(
            compare('GT', '<block type="total_profit" />', number(-stopLoss)),
            continueTrading
        );
    }

    const updateStake = ifElse(
        '<block type="contract_check_result"><field name="CHECK_RESULT">loss</field></block>',
        settings.martingale
            ? variableSet(
                  'Current stake',
                  `<block type="math_arithmetic" id="${nextId()}"><field name="OP">MULTIPLY</field>` +
                      `<value name="A">${variableGet('Current stake')}</value>` +
                      `<value name="B">${number(multiplier)}</value></block>`
              )
            : variableSet('Current stake', number(stake)),
        variableSet('Current stake', number(stake)),
        continueTrading
    );
    const afterPurchase = variableSet('Entry streak', number(0), updateStake);

    return `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <block type="trade_definition" id="${nextId()}" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="${nextId()}">
        <field name="MARKET_LIST">volidx</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="${nextId()}">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" id="${nextId()}">
                <field name="TYPE_LIST">${bot.contractType}</field>
                <next>
                  <block type="trade_definition_candleinterval" id="${nextId()}">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="${nextId()}">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="${nextId()}">
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
    <statement name="INITIALIZATION">
      ${variableSet('Entry streak', number(0), variableSet('Current stake', number(stake)))}
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="${nextId()}">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${hasPrediction}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION">${number(tickDuration)}</value>
        <value name="AMOUNT">${variableGet('Current stake')}</value>
        ${hasPrediction ? `<value name="PREDICTION">${number(barrier)}</value>` : ''}
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="${nextId()}" x="0" y="430">
    <statement name="BEFOREPURCHASE_STACK">${updateStreak}</statement>
  </block>
  <block type="after_purchase" id="${nextId()}" x="0" y="610">
    <statement name="AFTERPURCHASE_STACK">${afterPurchase}</statement>
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
        description: 'Waits for consecutive Over digits above 5, then enters an Under contract.',
        contractType: 'DIGITUNDER',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'over-master',
        name: 'Over Master Bot',
        description: 'Waits for consecutive Under digits below 5, then enters an Over contract.',
        contractType: 'DIGITOVER',
        defaultConsecutiveTicks: 5,
    },
    {
        id: 'digit-streak-differs',
        name: 'Digit / Differs Master Bot',
        description: 'Waits for the configured digit streak, then enters a Differs contract against that digit.',
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
