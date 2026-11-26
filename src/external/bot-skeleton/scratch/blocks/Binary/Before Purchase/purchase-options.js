import { config } from '../../../../constants/config';

export const getInitialPurchaseOptions = () => {
    const options = new Map();

    Object.values(config().opposites)
        .flat()
        .forEach(contract => {
            const [value, label] = Object.entries(contract)[0];
            if (!options.has(value)) options.set(value, [label, value]);
        });

    return Array.from(options.values());
};
