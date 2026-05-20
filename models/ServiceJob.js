const FileDatabaseManager = require('../file_db_manager');

class ServiceJob {
    constructor() {
        this.db = new FileDatabaseManager();
        /**
         * New Workflow Fields:
         * salesInvoiceId: ObjectId (ref: SalesInvoice)
         * status: Enum ['PENDING_OPS', 'PENDING_WAREHOUSE', 'IN_PROGRESS', 'COMPLETED'] (Default: 'PENDING_OPS')
         * items: [{
         *    productId: ObjectId (ref: Product) - Inventory product selected by Ops
         *    assignedTechnicianId: ObjectId (ref: Employee) - Technician assigned to this item by Ops
         *    rating: Number (1-10) - Technician rating for this item, set by Ops
         *    // ... other original item fields from Sales Invoice
         * }]
         * // NOTE: requiredProducts and technicianAssignments are now integrated into the 'items' array.
         * // issuedInventory: [{ barcode: String, quantity: Number }] - Set by Warehouse
         */
    }

    normalizeJobType(type) {
        const allowed = ['SALES', 'WARRANTY', 'REISSUE'];
        const normalized = String(type || 'SALES').toUpperCase();
        return allowed.includes(normalized) ? normalized : 'SALES';
    }

    normalizeSourceType(sourceType) {
        const allowed = ['INVOICE', 'WARRANTY_REQUEST', 'REISSUE_REQUEST'];
        const normalized = String(sourceType || '').toUpperCase();
        return allowed.includes(normalized) ? normalized : 'INVOICE';
    }

    normalizeItem(item = {}) {
        const returnedQuantity = Number(item.returnedQuantity || 0);
        const usableQuantity = Number(item.usableQuantity || 0);
        const wasteQuantity = Number(item.wasteQuantity || 0);
        const status = String(item.returnedStatus || 'none').toLowerCase();
        const allowedStatus = ['none', 'partial_usable', 'full_waste'];

        return {
            ...item,
            returnedQuantity: Number.isFinite(returnedQuantity) ? returnedQuantity : 0,
            returnedStatus: allowedStatus.includes(status) ? status : 'none',
            usableQuantity: Number.isFinite(usableQuantity) ? usableQuantity : 0,
            wasteQuantity: Number.isFinite(wasteQuantity) ? wasteQuantity : 0
        };
    }

    normalizePayload(data = {}) {
        const items = Array.isArray(data.items) ? data.items.map((item) => this.normalizeItem(item)) : [];
        return {
            ...data,
            type: this.normalizeJobType(data.type),
            sourceType: this.normalizeSourceType(data.sourceType),
            sourceId: data.sourceId || '',
            warrantyInfo: data.warrantyInfo || null,
            reissueInfo: data.reissueInfo || null,
            items
        };
    }

    normalizeUpdatePayload(data = {}) {
        const payload = { ...data };
        if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
            payload.type = this.normalizeJobType(payload.type);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'sourceType')) {
            payload.sourceType = this.normalizeSourceType(payload.sourceType);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'items') && Array.isArray(payload.items)) {
            payload.items = payload.items.map((item) => this.normalizeItem(item));
        }
        return payload;
    }

    async create(data) {
        return await this.db.create('servicejobs', this.normalizePayload(data));
    }

    async find(query = {}) {
        return await this.db.find('servicejobs', query);
    }

    async findOne(query) {
        return await this.db.findOne('servicejobs', query);
    }

    async findById(id) {
        return await this.db.findById('servicejobs', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('servicejobs', query, this.normalizeUpdatePayload(updateData));
    }

    // --- Potentially Unused/Deprecated Methods ---
    // These methods might be part of an older workflow or superseded by other routes/services.
    // Please review their usage and remove if no longer needed.
    async deleteOne(query) {
        return await this.db.deleteOne('servicejobs', query);
    }

    async countDocuments(query = {}) {
        return await this.db.countDocuments('servicejobs', query);
    }

    // New method for Operations Manager to set up the job
    async opsSetup(jobId, itemsData) {
        const job = await this.findById(jobId);
        if (!job) throw new Error('Service Job not found');

        // Ensure job.items is initialized and merge with existing items
        let currentItems = Array.isArray(job.items) ? job.items : [];
        const updatedItems = currentItems.map((existingItem, index) => {
            const newItemData = itemsData.find(data => data.itemIndex === index); // Find by itemIndex
            if (newItemData) {
                return {
                    ...existingItem,
                    product: newItemData.productId, // Renamed to 'product' to match frontend usage
                    assignedTechnicianId: newItemData.assignedTechnicianId,
                    // These fields should ideally come from the original sales invoice item,
                    // but ops can confirm/override. For now, pull from newItemData if provided.
                    partName: newItemData.partName || existingItem.partName,
                    lengthCM: newItemData.lengthCM || existingItem.lengthCM,
                    widthCM: newItemData.widthCM || existingItem.widthCM,
                    area: newItemData.area || existingItem.area,
                    // Reset rating if re-setting up ops
                    rating: null 
                };
            }
            return existingItem;
        });
        
        // Add any new items that were not part of the original job.items (though this scenario is less likely for existing jobs)
        // For new service jobs, itemsData might contain all initial items.
        // This part needs careful consideration if new items can be added via ops setup for an existing job.
        // If itemsData might contain entirely new items not corresponding to existing job.items,
        // more complex merge logic would be needed.
        
        return await this.updateOne(
            { _id: jobId },
            {
                items: updatedItems,
                status: 'PENDING_WAREHOUSE'
            }
        );
    }

    // New method for Operations Manager to rate items and complete the job
    async rateItems(jobId, itemRatings) {
        const job = await this.findById(jobId);
        if (!job) throw new Error('Service Job not found');

        const updatedItems = (job.items || []).map((item, index) => {
            const ratingData = itemRatings.find(r => r.itemIndex === index); // Find by itemIndex
            if (ratingData) {
                return {
                    ...item,
                    rating: ratingData.rating
                };
            }
            return item;
        });

        return await this.updateOne(
            { _id: jobId },
            {
                items: updatedItems,
                status: 'COMPLETED'
            }
        );
    }
}

module.exports = new ServiceJob();
