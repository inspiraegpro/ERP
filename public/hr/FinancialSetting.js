const db = require('../file_db_manager');

class FinancialSetting {
    static collection = 'financialSettings';

    static async getSettings() {
        const settings = await db.find(this.collection);
        return settings.length > 0 ? settings[0] : {};
    }

    static async updateSettings(newSettings) {
        const existing = await this.getSettings();
        if (existing._id) {
            return await db.updateOne({ _id: existing._id }, newSettings);
        }
        return await db.create(this.collection, newSettings);
    }
}

module.exports = FinancialSetting;