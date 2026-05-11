const FileDatabaseManager = require('../file_db_manager');

class FinancialSettings {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    /**
     * Get the single settings document
     */
    async findOne() {
        const settings = await this.db.find('financial_settings');
        return settings.length > 0 ? settings[0] : null;
    }

    /**
     * Create or update settings
     */
    async save(data) {
        const existing = await this.findOne();
        if (existing) {
            return await this.db.updateOne('financial_settings', 
                { _id: existing._id }, 
                { ...data, updatedAt: new Date().toISOString() }
            );
        } else {
            return await this.db.create('financial_settings', {
                ...data,
                _id: 'settings_financial',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }
}

module.exports = new FinancialSettings();
