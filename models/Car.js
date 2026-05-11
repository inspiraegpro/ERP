const FileDatabaseManager = require('../file_db_manager');

class Car {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new car
    async create(data) {
        return await this.db.create('cars', data);
    }

    // Find all cars
    async find(query = {}) {
        return await this.db.find('cars', query);
    }

    // Find one car
    async findOne(query) {
        return await this.db.findOne('cars', query);
    }

    // Update car
    async updateOne(query, updateData) {
        return await this.db.updateOne('cars', query, updateData);
    }

    // Delete car
    async deleteOne(query) {
        return await this.db.deleteOne('cars', query);
    }

    // Count cars
    async countDocuments(query = {}) {
        return await this.db.countDocuments('cars', query);
    }
}

module.exports = new Car();