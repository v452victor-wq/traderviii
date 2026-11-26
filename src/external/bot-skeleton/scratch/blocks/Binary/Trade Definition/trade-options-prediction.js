export const getTradeOptionsPrediction = (hasPredictionInput, predictionValue) =>
    hasPredictionInput ? predictionValue || '-1' : undefined;
