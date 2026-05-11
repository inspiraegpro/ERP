const fs = require('fs');
const path = require('path');

const pricingLogic = {
    VAT_RATE: 0.14,
    getPriceForInvoice: async (params, allProducts) => {
        // دعم الباراميترات المختلفة للتوافق مع sales_invoice.html
        const serviceType = params.serviceType || params.serviceName;
        const category = params.category || serviceType;
        const carSize = params.carSize || params.vehicleCategory;
        const partName = params.partName;
        const quantity = params.quantity || 1;
        const qty = parseFloat(quantity) || 1;

        // مسار ملف مصفوفة العزل
        const matrixPath = path.join(__dirname, '../data_storage/pricingmatrices/pricing_matrix.json');

        // تحسين: البحث في المصفوفة لكل أنواع الخدمات التي تعتمد على مقاس السيارة والجزء
        // وليس فقط Window Film، لضمان الربط القوي مع مصفوفة الأسعار
        if (partName && carSize) {
            try {
                if (fs.existsSync(matrixPath)) {
                    const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
                    const entry = matrix.find(e => 
                        String(e.carSize).trim().toLowerCase() === String(carSize).trim().toLowerCase() &&
                        String(e.partName).trim().toLowerCase() === String(partName).trim().toLowerCase() &&
                        (e.materialType ? String(e.materialType).toLowerCase() === String(category).toLowerCase() : true)
                    );
                    
                    if (entry && entry.netPrice) return entry.netPrice * qty;
                    if (entry && entry.inclusivePrice) return (entry.inclusivePrice / (1 + pricingLogic.VAT_RATE)) * qty;
                }
            } catch (e) { console.error("Pricing Logic Matrix Error:", e.message); }
        }

        // ب- فحص المنتجات كخيار احتياطي (Fallback)
        if (!allProducts) return 0;

        // ب- إذا كانت خامات أخرى (PPF, MATT, Vinyl) تسعر من شاشة المنتجات بالتبويب
        // البحث يتم في عمود التبويب (category أو type أو serviceCategory) وليس في اسم الصنف
        const categoryProduct = allProducts.find(p => {
            const categoryLower = String(category || '').toLowerCase();
            const categoryFieldLower = String(p.category || '').toLowerCase();
            const typeFieldLower = String(p.type || '').toLowerCase();
            const serviceCategoryFieldLower = String(p.serviceCategory || '').toLowerCase();
            
            // مطابقة تامة أو جزئية في category أو type أو serviceCategory
            return categoryFieldLower === categoryLower || 
                   typeFieldLower === categoryLower ||
                   serviceCategoryFieldLower === categoryLower ||
                   categoryFieldLower.includes(categoryLower) ||
                   typeFieldLower.includes(categoryLower) ||
                   serviceCategoryFieldLower.includes(categoryLower);
        });
        if (categoryProduct && categoryProduct.pricing) {
            // استخدم priceWithoutVat إذا كان موجوداً، وإلا احسب من salePrice
            let price = categoryProduct.pricing.priceWithoutVat || 0;
            if (price === 0 && categoryProduct.pricing.salePrice) {
                price = categoryProduct.pricing.salePrice / (1 + pricingLogic.VAT_RATE);
            }
            return price * qty;
        }

        return 0;
    }
};
module.exports = pricingLogic;