const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function updateWindowFilmStructure() {
    console.log('🔄 جاري تحديث هيكل Window Film...');
    
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        // 1. حذف منتجات Window Film القديمة
        const existingProducts = await db.find('products');
        const windowFilmProducts = existingProducts.filter(p => 
            p.serviceCategory === 'Thermal Insulation Window Film'
        );
        
        console.log(`🗑️ سيتم حذف ${windowFilmProducts.length} منتج Window Film قديم`);
        
        for (const product of windowFilmProducts) {
            await db.delete('products', product._id);
        }

        // 2. إنشاء منتجات Window Film جديدة بالدرجات 1-6
        const windowFilmServices = [
            // Sedan
            { name: "Window Film Grade 1", parts: "2 Doors", price: 4000, carSize: "Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "2 Doors", price: 4500, carSize: "Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "2 Doors", price: 5000, carSize: "Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "2 Doors", price: 5500, carSize: "Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "2 Doors", price: 6000, carSize: "Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "2 Doors", price: 6500, carSize: "Sedan", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "4 Doors", price: 8000, carSize: "Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "4 Doors", price: 8500, carSize: "Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "4 Doors", price: 9000, carSize: "Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "4 Doors", price: 9500, carSize: "Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "4 Doors", price: 10000, carSize: "Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "4 Doors", price: 10500, carSize: "Sedan", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "Front Windshield", price: 4000, carSize: "Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "Front Windshield", price: 4500, carSize: "Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "Front Windshield", price: 5000, carSize: "Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "Front Windshield", price: 5500, carSize: "Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "Front Windshield", price: 6000, carSize: "Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "Front Windshield", price: 6500, carSize: "Sedan", grade: 6 },
            
            // SUV/Large Sedan
            { name: "Window Film Grade 1", parts: "2 Doors", price: 4000, carSize: "SUV/Large Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "2 Doors", price: 4500, carSize: "SUV/Large Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "2 Doors", price: 5000, carSize: "SUV/Large Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "2 Doors", price: 5500, carSize: "SUV/Large Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "2 Doors", price: 6000, carSize: "SUV/Large Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "2 Doors", price: 6500, carSize: "SUV/Large Sedan", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "4 Doors", price: 8000, carSize: "SUV/Large Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "4 Doors", price: 8500, carSize: "SUV/Large Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "4 Doors", price: 9000, carSize: "SUV/Large Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "4 Doors", price: 9500, carSize: "SUV/Large Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "4 Doors", price: 10000, carSize: "SUV/Large Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "4 Doors", price: 10500, carSize: "SUV/Large Sedan", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "Front Windshield", price: 5000, carSize: "SUV/Large Sedan", grade: 1 },
            { name: "Window Film Grade 2", parts: "Front Windshield", price: 5500, carSize: "SUV/Large Sedan", grade: 2 },
            { name: "Window Film Grade 3", parts: "Front Windshield", price: 6000, carSize: "SUV/Large Sedan", grade: 3 },
            { name: "Window Film Grade 4", parts: "Front Windshield", price: 6500, carSize: "SUV/Large Sedan", grade: 4 },
            { name: "Window Film Grade 5", parts: "Front Windshield", price: 7000, carSize: "SUV/Large Sedan", grade: 5 },
            { name: "Window Film Grade 6", parts: "Front Windshield", price: 7500, carSize: "SUV/Large Sedan", grade: 6 },
            
            // Large SUV
            { name: "Window Film Grade 1", parts: "2 Doors", price: 4000, carSize: "Large SUV", grade: 1 },
            { name: "Window Film Grade 2", parts: "2 Doors", price: 4500, carSize: "Large SUV", grade: 2 },
            { name: "Window Film Grade 3", parts: "2 Doors", price: 5000, carSize: "Large SUV", grade: 3 },
            { name: "Window Film Grade 4", parts: "2 Doors", price: 5500, carSize: "Large SUV", grade: 4 },
            { name: "Window Film Grade 5", parts: "2 Doors", price: 6000, carSize: "Large SUV", grade: 5 },
            { name: "Window Film Grade 6", parts: "2 Doors", price: 6500, carSize: "Large SUV", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "4 Doors", price: 8000, carSize: "Large SUV", grade: 1 },
            { name: "Window Film Grade 2", parts: "4 Doors", price: 8500, carSize: "Large SUV", grade: 2 },
            { name: "Window Film Grade 3", parts: "4 Doors", price: 9000, carSize: "Large SUV", grade: 3 },
            { name: "Window Film Grade 4", parts: "4 Doors", price: 9500, carSize: "Large SUV", grade: 4 },
            { name: "Window Film Grade 5", parts: "4 Doors", price: 10000, carSize: "Large SUV", grade: 5 },
            { name: "Window Film Grade 6", parts: "4 Doors", price: 10500, carSize: "Large SUV", grade: 6 },
            
            { name: "Window Film Grade 1", parts: "Front Windshield", price: 5000, carSize: "Large SUV", grade: 1 },
            { name: "Window Film Grade 2", parts: "Front Windshield", price: 5500, carSize: "Large SUV", grade: 2 },
            { name: "Window Film Grade 3", parts: "Front Windshield", price: 6000, carSize: "Large SUV", grade: 3 },
            { name: "Window Film Grade 4", parts: "Front Windshield", price: 6500, carSize: "Large SUV", grade: 4 },
            { name: "Window Film Grade 5", parts: "Front Windshield", price: 7000, carSize: "Large SUV", grade: 5 },
            { name: "Window Film Grade 6", parts: "Front Windshield", price: 7500, carSize: "Large SUV", grade: 6 }
        ];

        for (const service of windowFilmServices) {
            await db.create('products', {
                name: service.name,
                type: "Thermal Insulation Window Film",
                serviceCategory: "Thermal Insulation Window Film",
                parts: service.parts,
                carSize: service.carSize,
                grade: service.grade,
                pricingType: "عدد",
                unit: "قطعة",
                pricing: {
                    salePrice: service.price,
                    unitSalePrice: service.price
                },
                isActive: true,
                createdAt: new Date().toISOString()
            });
        }

        console.log(`✅ تم إنشاء ${windowFilmServices.length} خدمة Window Film بالدرجات 1-6`);
        console.log('\n🎉 اكتمل تحديث هيكل Window Film!');
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الهيكل:', error.message);
    }
}

// تنفيذ عملية التحديث
updateWindowFilmStructure().then(() => {
    console.log('\n✨ جاهز للاستخدام!');
    process.exit(0);
}).catch(error => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
});
