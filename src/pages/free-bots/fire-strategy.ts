export const setFireStrategyStake = (xml: string, value: string | number) => {
    const stake = Number(value);
    if (!Number.isFinite(stake) || stake < 0.01) {
        throw new Error('Enter a stake of at least 0.01.');
    }

    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) {
        throw new Error('The Over 2 Fire and Under 7 Fire strategy file is invalid.');
    }

    const stakeField = document.querySelector('block[id="flat_stake"] field[name="NUM"]');
    if (!stakeField) {
        throw new Error('The strategy stake block could not be found.');
    }

    stakeField.textContent = stake.toFixed(2);
    return new XMLSerializer().serializeToString(document);
};
