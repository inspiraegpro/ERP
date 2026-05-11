const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function fixWindowFilm() {
    console.log('🔄 جاري تحديث منتجات العازل الحراري...');
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        const existingProducts = await db.find('products');
        
        // 1. Delete all existing window film products
        const windowFilmProducts = existingProducts.filter(p => 
            p.serviceCategory === 'Thermal Insulation Window Film' || 
            p.name.includes('Window Film')
        );
        for (const p of windowFilmProducts) {
            await db.deleteOne('products', { _id: p._id });
        }

        // 2. Insert the fixed prices (ONE per part per Car Size). Grades will be text-based in UI.
        const baseParts = [
            { name: '2 Doors', sedanPrice: 4000, suvPrice: 4500, largeSuvPrice: 5000 },
            { name: '4 Doors', sedanPrice: 8000, suvPrice: 9000, largeSuvPrice: 10000 },
            { name: 'Front Windshield', sedanPrice: 4000, suvPrice: 4500, largeSuvPrice: 5000 },
            { name: 'Rear Windshield', sedanPrice: 4000, suvPrice: 4500, largeSuvPrice: 5000 },
            { name: 'Sunroof', sedanPrice: 4000, suvPrice: 4500, largeSuvPrice: 5000 },
            { name: 'Full Glass Roof', sedanPrice: 6000, suvPrice: 7000, largeSuvPrice: 8000 },
            { name: 'Half Package', sedanPrice: 7000, suvPrice: 8000, largeSuvPrice: 9000 },
            { name: 'Full Package', sedanPrice: 14000, suvPrice: 16000, largeSuvPrice: 18000 }
        ];

        let count = 0;
        for (const p of baseParts) {
            const sizes = [
                { s: 'Sedan', price: p.sedanPrice },
                { s: 'SUV/Large Sedan', price: p.suvPrice },
                { s: 'Large SUV', price: p.largeSuvPrice }
            ];

            for (const size of sizes) {
                await db.create('products', {
                    name: `Window Film - ${p.name}`,
                    type: "Thermal Insulation Window Film",
                    serviceCategory: "Thermal Insulation Window Film",
                    parts: p.name,
                    carSize: size.s,
                    pricingType: "عدد",
                    unit: "قطعة",
                    pricing: {
                        salePrice: size.price,
                        unitSalePrice: size.price
                    },
                    isActive: true,
                    createdAt: new Date().toISOString()
                });
                count++;
            }
        }

        console.log(`✅ تم إنشاء ${count} منتج بناءً على الأسعار الثابتة`);
    } catch (e) {
        console.error(e);
    }
}

fixWindowFilm();
