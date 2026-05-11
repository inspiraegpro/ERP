const FileDatabaseManager = require('../file_db_manager');

class Sequence {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new sequence
    async create(sequenceData) {
        return await this.db.create('sequences', sequenceData);
    }

    // Find all sequences
    async find(query = {}) {
        return await this.db.find('sequences', query);
    }

    // Find one sequence
    async findOne(query) {
        return await this.db.findOne('sequences', query);
    }

    // Find by sequence type
    async findByType(type) {
        return await this.db.findOne('sequences', { type });
    }

    // Update sequence
    async updateOne(query, updateData) {
        return await this.db.updateOne('sequences', query, updateData);
    }

    // Update sequence by type
    async updateByType(type, updateData) {
        return await this.db.updateOne('sequences', { type }, updateData);
    }

    // Delete sequence
    async deleteOne(query) {
        return await this.db.deleteOne('sequences', query);
    }

    // Count sequences
    async countDocuments(query = {}) {
        return await this.db.countDocuments('sequences', query);
    }

    // Get next sequence number
    async getNextNumber(type) {
        let sequence = await this.findByType(type);
        
        if (!sequence) {
            // Create new sequence if not exists
            sequence = await this.create({
                type: type,
                prefix: this.getPrefix(type),
                currentNumber: 1,
                padding: 4,
                description: this.getDescription(type)
            });
        } else {
            // Update existing sequence
            sequence = await this.updateByType(type, {
                currentNumber: sequence.currentNumber + 1
            });
        }

        return this.formatSequenceNumber(sequence);
    }

    // Get current sequence number
    async getCurrentNumber(type) {
        const sequence = await this.findByType(type);
        if (!sequence) {
            return null;
        }
        return this.formatSequenceNumber(sequence);
    }

    // Reset sequence
    async resetSequence(type, newNumber = 1) {
        return await this.updateByType(type, {
            currentNumber: newNumber
        });
    }

    // Format sequence number
    formatSequenceNumber(sequence) {
        const paddedNumber = String(sequence.currentNumber).padStart(sequence.padding, '0');
        return `${sequence.prefix}${paddedNumber}`;
    }

    // Get prefix for sequence type
    getPrefix(type) {
        const prefixes = {
            'SALES': 'INV',
            'PURCHASE': 'PO',
            'PAYMENT': 'PAY',
            'RECEIPT': 'REC',
            'JOURNAL': 'JE',
            'TRANSFER': 'TRF',
            'ADJUSTMENT': 'ADJ'
        };
        return prefixes[type] || 'SEQ';
    }

    // Get description for sequence type
    getDescription(type) {
        const descriptions = {
            'SALES': 'Sales Invoice Sequence',
            'PURCHASE': 'Purchase Order Sequence',
            'PAYMENT': 'Payment Sequence',
            'RECEIPT': 'Receipt Sequence',
            'JOURNAL': 'Journal Entry Sequence',
            'TRANSFER': 'Stock Transfer Sequence',
            'ADJUSTMENT': 'Stock Adjustment Sequence'
        };
        return descriptions[type] || 'General Sequence';
    }

    // Initialize default sequences
    async initializeDefaultSequences() {
        const defaultTypes = ['SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'TRANSFER', 'ADJUSTMENT'];
        
        for (const type of defaultTypes) {
            const existing = await this.findByType(type);
            if (!existing) {
                await this.create({
                    type: type,
                    prefix: this.getPrefix(type),
                    currentNumber: 1,
                    padding: 4,
                    description: this.getDescription(type)
                });
            }
        }
    }

    // Get all sequences with current numbers
    async getAllSequences() {
        const sequences = await this.find();
        return sequences.map(seq => ({
            ...seq,
            currentFormatted: this.formatSequenceNumber(seq),
            nextFormatted: this.formatSequenceNumber({
                ...seq,
                currentNumber: seq.currentNumber + 1
            })
        }));
    }

    // Validate sequence type
    validateType(type) {
        const validTypes = ['SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'TRANSFER', 'ADJUSTMENT'];
        return validTypes.includes(type);
    }
}

module.exports = new Sequence();