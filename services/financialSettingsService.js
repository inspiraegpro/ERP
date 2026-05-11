const FinancialSettings = require('../models/FinancialSettings');

const financialSettingsService = {
    /**
     * Fetch the single financial settings document
     */
    getSettings: async () => {
        return await FinancialSettings.findOne();
    },

    /**
     * Update the financial settings document
     */
    updateSettings: async (data) => {
        return await FinancialSettings.save(data);
    }
};

module.exports = financialSettingsService;
