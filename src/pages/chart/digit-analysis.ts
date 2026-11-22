export const DIGIT_CONTRACT_TYPES = [
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITEVEN',
    'DIGITODD',
    'DIGITMATCH',
    'DIGITDIFF',
] as const;

export type DigitContractType = (typeof DIGIT_CONTRACT_TYPES)[number];

export const getDigitDistribution = (prices: Array<number | string>, pipSize: number) => {
    const digits = Array.from({ length: 10 }, (_, digit) => ({ digit, count: 0 }));
    const precision = Number.isInteger(pipSize) && pipSize >= 0 && pipSize <= 10 ? pipSize : 2;

    prices.forEach(price => {
        const formattedPrice = Number(price).toFixed(precision);
        const lastCharacter = formattedPrice.replace('.', '').slice(-1);
        const lastDigit = Number(lastCharacter);

        if (Number.isInteger(lastDigit) && lastDigit >= 0 && lastDigit <= 9) {
            digits[lastDigit].count += 1;
        }
    });

    return digits;
};

export const buildDigitProposalRequest = ({
    amount,
    barrier,
    contractType,
    currency,
    duration,
    symbol,
}: {
    amount: number;
    barrier: number;
    contractType: DigitContractType;
    currency: string;
    duration: number;
    symbol: string;
}) => {
    const request: {
        amount: number;
        basis: 'stake';
        contract_type: DigitContractType;
        currency: string;
        duration: number;
        duration_unit: 't';
        proposal: 1;
        underlying_symbol: string;
        barrier?: number;
    } = {
        amount,
        basis: 'stake',
        contract_type: contractType,
        currency,
        duration,
        duration_unit: 't',
        proposal: 1,
        underlying_symbol: symbol,
    };

    if (
        contractType === 'DIGITOVER' ||
        contractType === 'DIGITUNDER' ||
        contractType === 'DIGITMATCH' ||
        contractType === 'DIGITDIFF'
    ) {
        request.barrier = barrier;
    }

    return request;
};
