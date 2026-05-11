/**
 * Fix Missing Window Film Products
 * Adds 2 Doors (Sedan, SUV/Large Sedan) and 4 Doors (all sizes)
 * that are missing from the database
 */
const FileDatabaseManager = require('./file_db_manager');
const db = new FileDatabaseManager();

async function fixMissingWFProducts() {
    const existing = await db.find('products', { serviceCategory: 'Thermal Insulation Window Film' });
    
    console.log(`\n📦 Found ${existing.length} existing Window Film products:`);
    existing.forEach(p => console.log(`   - ${p.name} | parts=${p.parts} | carSize=${p.carSize} | price=${p.pricing?.salePrice}`));

    // Define all required combinations
    const requiredProducts = [
        // 2 Doors
        { parts: '2 Doors', carSize: 'Sedan', price: 4000 },
        { parts: '2 Doors', carSize: 'SUV/Large Sedan', price: 4000 },
        { parts: '2 Doors', carSize: 'Large SUV', price: 4000 },
        // 4 Doors
        { parts: '4 Doors', carSize: 'Sedan', price: 8000 },
        { parts: '4 Doors', carSize: 'SUV/Large Sedan', price: 8000 },
        { parts: '4 Doors', carSize: 'Large SUV', price: 8000 },
        // Full Package + Sunroof
        { parts: 'Full Package + Sunroof', carSize: 'Sedan', price: 16000 },
        { parts: 'Full Package + Sunroof', carSize: 'SUV/Large Sedan', price: 19000 },
        { parts: 'Full Package + Sunroof', carSize: 'Large SUV', price: 20000 },
        // Full Package + Full Roof
        { parts: 'Full Package + Full Roof', carSize: 'Sedan', price: 18000 },
        { parts: 'Full Package + Full Roof', carSize: 'SUV/Large Sedan', price: 21000 },
        { parts: 'Full Package + Full Roof', carSize: 'Large SUV', price: 22000 },
    ];

    let added = 0;
    for (const req of requiredProducts) {
        const exists = existing.find(p => p.parts === req.parts && p.carSize === req.carSize);
        if (!exists) {
            const newProduct = {
                name: `Window Film - ${req.parts}`,
                type: 'Thermal Insulation Window Film',
                serviceCategory: 'Thermal Insulation Window Film',
                parts: req.parts,
                carSize: req.carSize,
                pricingType: 'عدد',
                unit: 'قطعة',
                pricing: {
                    salePrice: req.price,
                    unitSalePrice: req.price
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await db.create('products', newProduct);
            console.log(`✅ Added: ${newProduct.name} (${req.carSize}) - ${req.price} EGP`);
            added++;
        } else {
            console.log(`⏭️  Already exists: ${req.parts} (${req.carSize})`);
        }
    }

    console.log(`\n🏁 Done! Added ${added} missing products.`);
    process.exit(0);
}

fixMissingWFProducts().catch(e => { console.error(e); process.exit(1); });
