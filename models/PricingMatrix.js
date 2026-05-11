const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();

class PricingMatrix {
    constructor(data = {}) {
        this._id = data._id || null;
        this.materialType = data.materialType || '';
        this.vehicleCategory = data.vehicleCategory || '';
        this.carPart = data.carPart || '';
        this.grade = data.grade || null; // Window Film grade 1-6
        this.basePrice = data.basePrice || 0; // Fixed price (not per sqm)
        this.basePricePerSquareMeter = data.basePricePerSquareMeter || 0; // For area-based pricing
        this.minPrice = data.minPrice || 0;
        this.maxPrice = data.maxPrice || 0;
        this.pricingTier = data.pricingTier || 'Standard';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.notes = data.notes || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    static async findAll(filters = {}) {
        const pricingMatrices = await db.find('pricingmatrices');
        let result = pricingMatrices || [];
        
        if (filters.materialType) {
            result = result.filter(p => p.materialType === filters.materialType);
        }
        if (filters.vehicleCategory) {
            result = result.filter(p => p.vehicleCategory === filters.vehicleCategory);
        }
        if (filters.carPart) {
            result = result.filter(p => p.carPart === filters.carPart);
        }
        if (filters.isActive !== undefined) {
            result = result.filter(p => p.isActive === filters.isActive);
        }
        
        return result;
    }

    static async findMatchingPricing(materialType, vehicleCategory, carPart, grade = null) {
        const pricingMatrices = await db.find('pricingmatrices');
        
        // Helper function for flexible string matching
        const matches = (value, pattern) => {
            if (!value || !pattern) return false;
            const valStr = value.toString().toLowerCase().trim();
            const patStr = pattern.toString().toLowerCase().trim();
            // Check if either contains the other (flexible matching)
            return valStr === patStr || 
                   valStr.includes(patStr) || 
                   patStr.includes(valStr);
        };
        
        // Normalize car size names (handle different formats)
        const normalizeCarSize = (size) => {
            if (!size) return '';
            const s = size.toLowerCase().trim();
            if (s.includes('sedan') && !s.includes('large')) return 'sedan';
            if (s.includes('suv') || s.includes('large sedan')) return 'suv/large sedan';
            if (s.includes('large suv') || s.includes('جيب')) return 'large suv';
            return s;
        };
        
        const normalizedVehicleCategory = normalizeCarSize(vehicleCategory);
        
        // Try exact match with grade first (if grade provided)
        let match = null;
        if (grade !== null) {
            match = (pricingMatrices || []).find(p => 
                matches(p.materialType, materialType) &&
                (matches(p.vehicleCategory, vehicleCategory) || 
                 normalizeCarSize(p.vehicleCategory) === normalizedVehicleCategory) &&
                matches(p.carPart, carPart) &&
                p.grade === grade &&
                p.isActive === true
            );
        }
        
        // Try exact match without grade
        if (!match) {
            match = (pricingMatrices || []).find(p => 
                matches(p.materialType, materialType) &&
                (matches(p.vehicleCategory, vehicleCategory) || 
                 normalizeCarSize(p.vehicleCategory) === normalizedVehicleCategory) &&
                matches(p.carPart, carPart) &&
                p.isActive === true
            );
        }
        
        // If no exact match, try material + vehicle category only
        if (!match) {
            match = (pricingMatrices || []).find(p => 
                matches(p.materialType, materialType) &&
                (matches(p.vehicleCategory, vehicleCategory) || 
                 normalizeCarSize(p.vehicleCategory) === normalizedVehicleCategory) &&
                p.isActive === true
            );
        }
        
        // If still no match, try material type only
        if (!match) {
            match = (pricingMatrices || []).find(p => 
                matches(p.materialType, materialType) &&
                p.isActive === true
            );
        }
        
        // Last resort: try partial match on any field
        if (!match && materialType) {
            match = (pricingMatrices || []).find(p => 
                (matches(p.materialType, materialType) ||
                 matches(p.carPart, carPart) ||
                 matches(p.notes, materialType)) &&
                p.isActive === true
            );
        }
        
        return match || null;
    }

    static async calculatePrice(materialType, vehicleCategory, carPart, area, grade = null) {
        const pricing = await PricingMatrix.findMatchingPricing(materialType, vehicleCategory, carPart, grade);
        
        if (!pricing) {
            return {
                basePrice: 0,
                totalPrice: 0,
                pricingUsed: null
            };
        }
        
        // Use fixed price if available, otherwise calculate from per-sqm price
        let totalPrice;
        if (pricing.basePrice > 0) {
            // Fixed price (Window Film style)
            totalPrice = pricing.basePrice;
        } else if (pricing.basePricePerSquareMeter > 0 && area > 0) {
            // Area-based pricing (PPF style)
            totalPrice = pricing.basePricePerSquareMeter * area;
        } else {
            totalPrice = 0;
        }
        
        // Apply min/max constraints
        if (pricing.minPrice && totalPrice < pricing.minPrice) {
            totalPrice = pricing.minPrice;
        }
        if (pricing.maxPrice && totalPrice > pricing.maxPrice) {
            totalPrice = pricing.maxPrice;
        }
        
        return {
            basePrice: pricing.basePrice || pricing.basePricePerSquareMeter * (area || 1),
            totalPrice,
            pricingUsed: pricing
        };
    }

    async save() {
        this.updatedAt = new Date().toISOString();
        
        if (this._id) {
            await db.updateOne('pricingmatrices', { _id: this._id }, this);
        } else {
            const result = await db.create('pricingmatrices', this);
            this._id = result._id;
        }
        
        return this;
    }

    static async delete(id) {
        await db.deleteOne('pricingmatrices', { _id: id });
    }

    static async createDefaultPricingMatrices() {
        const defaults = [
            {
                materialType: 'Window Film',
                vehicleCategory: 'باقات سيدان',
                carPart: 'Windshield',
                basePricePerSquareMeter: 500,
                minPrice: 300,
                maxPrice: 2000,
                pricingTier: 'Standard',
                isActive: true,
                notes: 'Default pricing for sedan windshields'
            },
            {
                materialType: 'Window Film',
                vehicleCategory: 'باقات SUV',
                carPart: 'Windshield',
                basePricePerSquareMeter: 600,
                minPrice: 400,
                maxPrice: 2500,
                pricingTier: 'Premium',
                isActive: true,
                notes: 'Default pricing for SUV windshields'
            },
            {
                materialType: 'Window Film',
                vehicleCategory: 'باقات الجيب',
                carPart: 'Windshield',
                basePricePerSquareMeter: 700,
                minPrice: 500,
                maxPrice: 3000,
                pricingTier: 'Premium Plus',
                isActive: true,
                notes: 'Default pricing for large SUV windshields'
            },
            {
                materialType: 'PPF',
                vehicleCategory: 'باقات سيدان',
                carPart: 'Hood',
                basePricePerSquareMeter: 800,
                minPrice: 500,
                maxPrice: 3000,
                pricingTier: 'Premium',
                isActive: true,
                notes: 'Default pricing for sedan PPF hood'
            },
            {
                materialType: 'PPF',
                vehicleCategory: 'باقات SUV',
                carPart: 'Hood',
                basePricePerSquareMeter: 900,
                minPrice: 600,
                maxPrice: 3500,
                pricingTier: 'Premium Plus',
                isActive: true,
                notes: 'Default pricing for SUV PPF hood'
            }
        ];
        
        for (const defaultPricing of defaults) {
            const existing = await PricingMatrix.findMatchingPricing(
                defaultPricing.materialType,
                defaultPricing.vehicleCategory,
                defaultPricing.carPart
            );
            
            if (!existing) {
                await db.create('pricingmatrices', {
                    ...defaultPricing,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }
        
        return defaults.length;
    }
}

module.exports = PricingMatrix;
