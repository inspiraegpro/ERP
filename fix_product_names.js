const FileDatabaseManager = require('./file_db_manager');

async function fixProductNames() {
    const db = new FileDatabaseManager();

    try {
        const products = await db.find('products');
        console.log(`Found ${products.length} products to check`);

        // Define corrections for product names
        const nameCorrections = {
            // Fix incorrect names that have part names instead of material names
            'رول بلاستيك عازل': 'رول بلاستيك عازل',
            'رول عازل  الوان': 'رول عازل ملون',
            'فيلم حماية  ': 'فيلم حماية',
            'فينل الوان': 'فينل ملون',
            'Cتوزيع': 'فيلم توزيع C',
            'مط توزيع C': 'مط توزيع C',
            'وندو فيلم 1': 'وندو فيلم أساسي',
            'وندو فيلم 2': 'وندو فيلم متوسط',
            'وندو فيلم 3': 'وندو فيلم متقدم',
            'وندو فيلم 4': 'وندو فيلم فاخر',
            'وندو فيلم 5': 'وندو فيلم بلاتينيوم',
            'وندو فيلم 6': 'وندو فيلم كريستال',
            'تركيب عريض': 'تركيب عريض',
            ' كافر جنط': 'كافر جنط',
            'Plexi-عادي': 'بليكسي عادي',
            'Plexi-بلس': 'بليكسي بلس',
            'فنيل الوان': 'فينل ملون',
            'PPF Roll (الصنف)': 'رول PPF أساسي'
        };

        let updatedCount = 0;

        for (const product of products) {
            const originalName = product.name;
            const correctedName = nameCorrections[originalName];

            if (correctedName) {
                console.log(`Updating: "${originalName}" → "${correctedName}"`);
                product.name = correctedName;

                await db.updateOne('products', { _id: product._id }, product);
                updatedCount++;
            }
        }

        console.log(`\n✅ تم تصحيح ${updatedCount} منتج من أصل ${products.length}`);

        // Show summary of current products
        console.log('\n📋 ملخص المنتجات الحالية:');
        const updatedProducts = await db.find('products');
        const grouped = {};

        updatedProducts.forEach(p => {
            const type = p.type || 'غير مصنف';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(p);
        });

        for (const [type, items] of Object.entries(grouped)) {
            console.log(`\n🔸 نوع: ${type} (${items.length} منتج)`);
            items.forEach(p => {
                console.log(`   - ${p.name} (${p.unit || 'ROLL'})`);
            });
        }

    } catch (error) {
        console.error('❌ خطأ في تصحيح أسماء المنتجات:', error);
    }
}

fixProductNames();