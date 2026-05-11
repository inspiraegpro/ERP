const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function setupServiceCategories() {
    console.log('🔄 جاري إعداد فئات الخدمات والأسعار...');
    
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        // 1. حذف المنتجات القديمة اللي مش متعلقة بالخدمات
        const existingProducts = await db.find('products');
        const serviceProducts = existingProducts.filter(p => 
            p.type?.includes('خدمات') || 
            p.type?.includes('Window') || 
            p.type?.includes('Film') ||
            p.type?.includes('PPF') ||
            p.type?.includes('Matt')
        );
        
        console.log(`🗑️ سيتم حذف ${serviceProducts.length} منتج قديم`);
        
        for (const product of serviceProducts) {
            await db.delete('products', product._id);
        }

        // 2. إعداد فئات الخامات الرئيسية
        const serviceCategories = [
            {
                name: "Paint Protection Film (PPF)",
                code: "PPF",
                pricingType: "مقاسات",
                unit: "متر",
                basePrice: 0.31907,
                subcategories: [
                    { code: "PPF-001", name: "PPF Standard Gloss" },
                    { code: "PPF-002", name: "PPF Premium Matte" },
                    { code: "PPF-003", name: "PPF Ultra Clear" },
                    { code: "PPF-004", name: "PPF Black Gloss" },
                    { code: "PPF-005", name: "PPF Black Matte" },
                    { code: "PPF-006", name: "PPF White Gloss" },
                    { code: "PPF-007", name: "PPF Silver Metallic" },
                    { code: "PPF-008", name: "PPF Gold Metallic" },
                    { code: "PPF-009", name: "PPF Carbon Fiber" },
                    { code: "PPF-010", name: "PPF Brushed Metal" },
                    { code: "PPF-011", name: "PPF Chrome" },
                    { code: "PPF-012", name: "PPF Satin Clear" }
                ]
            },
            {
                name: "Paint Protection Film (MATT)",
                code: "MATT",
                pricingType: "مقاسات",
                unit: "متر",
                basePrice: 0.3828,
                subcategories: [
                    { code: "MATT-001", name: "Matt Standard Clear" },
                    { code: "MATT-002", name: "Matt Premium Black" },
                    { code: "MATT-003", name: "Matt Ultra Matte" },
                    { code: "MATT-004", name: "Matt Dark Gray" },
                    { code: "MATT-005", name: "Matt Light Gray" },
                    { code: "MATT-006", name: "Matt White" },
                    { code: "MATT-007", name: "Matt Blue" },
                    { code: "MATT-008", name: "Matt Red" },
                    { code: "MATT-009", name: "Matt Green" },
                    { code: "MATT-010", name: "Matt Brown" },
                    { code: "MATT-011", name: "Matt Beige" },
                    { code: "MATT-012", name: "Matt Custom Color" }
                ]
            },
            {
                name: "Thermal Insulation Window Film",
                code: "WINDOW_FILM",
                pricingType: "عدد",
                unit: "قطعة",
                pricing: "by_car_size_and_part"
            },
            {
                name: "Vinyl Color Wrap",
                code: "VINYL_WRAP",
                pricingType: "مقاسات",
                unit: "متر",
                basePrice: 0.25
            },
            {
                name: "Windshield Protection",
                code: "WINDSHIELD",
                pricingType: "عدد",
                unit: "قطعة"
            },
            {
                name: "Car Screen Protection",
                code: "SCREEN_PROTECTION",
                pricingType: "عدد",
                unit: "قطعة"
            },
            {
                name: "Additional Services",
                code: "ADDITIONAL",
                pricingType: "عدد",
                unit: "قطعة"
            }
        ];

        // 3. إنشاء منتجات PPF و Matt
        for (const category of serviceCategories.slice(0, 2)) { // PPF و Matt فقط
            for (const subcategory of category.subcategories) {
                await db.create('products', {
                    name: subcategory.name,
                    type: category.name,
                    serviceCategory: category.name,
                    subcategory: subcategory.code,
                    pricingType: category.pricingType,
                    unit: category.unit,
                    pricing: {
                        salePrice: category.basePrice,
                        unitSalePrice: category.basePrice
                    },
                    isActive: true,
                    createdAt: new Date().toISOString()
                });
            }
        }

        console.log(`✅ تم إنشاء ${serviceCategories[0].subcategories.length + serviceCategories[1].subcategories.length} منتج PPF و Matt`);

        // 4. إنشاء منتجات Window Film (حسب حجم السيارة والجزء)
        const windowFilmServices = [
            // Sedan
            { name: "Window Film 1", parts: "2 Doors", price: 4000, carSize: "Sedan" },
            { name: "Window Film 2", parts: "4 Doors", price: 8000, carSize: "Sedan" },
            { name: "Window Film 3", parts: "Front Windshield", price: 4000, carSize: "Sedan" },
            { name: "Window Film 4", parts: "Rear Windshield", price: 4000, carSize: "Sedan" },
            { name: "Window Film 5", parts: "Sunroof", price: 4000, carSize: "Sedan" },
            { name: "Window Film 6", parts: "Full Glass Roof", price: 6000, carSize: "Sedan" },
            { name: "Window Film Half Package", parts: "Half Package", price: 7000, carSize: "Sedan" },
            { name: "Window Film Full Package", parts: "Full Package", price: 14000, carSize: "Sedan" },
            { name: "Window Film Full Package + Sunroof", parts: "Full Package + Sunroof", price: 16000, carSize: "Sedan" },
            { name: "Window Film Full Package + Full Roof", parts: "Full Package + Full Roof", price: 18000, carSize: "Sedan" },
            
            // SUV/Large Sedan
            { name: "Window Film 1", parts: "2 Doors", price: 4000, carSize: "SUV/Large Sedan" },
            { name: "Window Film 2", parts: "4 Doors", price: 8000, carSize: "SUV/Large Sedan" },
            { name: "Window Film 3", parts: "Front Windshield", price: 5000, carSize: "SUV/Large Sedan" },
            { name: "Window Film 4", parts: "Rear Windshield", price: 5000, carSize: "SUV/Large Sedan" },
            { name: "Window Film 5", parts: "Sunroof", price: 5000, carSize: "SUV/Large Sedan" },
            { name: "Window Film 6", parts: "Full Glass Roof", price: 7000, carSize: "SUV/Large Sedan" },
            { name: "Window Film Half Package", parts: "Half Package", price: 8000, carSize: "SUV/Large Sedan" },
            { name: "Window Film Full Package", parts: "Full Package", price: 16000, carSize: "SUV/Large Sedan" },
            { name: "Window Film Full Package + Sunroof", parts: "Full Package + Sunroof", price: 19000, carSize: "SUV/Large Sedan" },
            { name: "Window Film Full Package + Full Roof", parts: "Full Package + Full Roof", price: 21000, carSize: "SUV/Large Sedan" },
            
            // Large SUV
            { name: "Window Film 1", parts: "2 Doors", price: 4000, carSize: "Large SUV" },
            { name: "Window Film 2", parts: "4 Doors", price: 8000, carSize: "Large SUV" },
            { name: "Window Film 3", parts: "Front Windshield", price: 5000, carSize: "Large SUV" },
            { name: "Window Film 4", parts: "Rear Windshield", price: 5000, carSize: "Large SUV" },
            { name: "Window Film 5", parts: "Sunroof", price: 6000, carSize: "Large SUV" },
            { name: "Window Film 6", parts: "Full Glass Roof", price: 8000, carSize: "Large SUV" },
            { name: "Window Film Half Package", parts: "Half Package", price: 8000, carSize: "Large SUV" },
            { name: "Window Film Full Package", parts: "Full Package", price: 16000, carSize: "Large SUV" },
            { name: "Window Film Full Package + Sunroof", parts: "Full Package + Sunroof", price: 20000, carSize: "Large SUV" },
            { name: "Window Film Full Package + Full Roof", parts: "Full Package + Full Roof", price: 22000, carSize: "Large SUV" }
        ];

        for (const service of windowFilmServices) {
            await db.create('products', {
                name: service.name,
                type: "Thermal Insulation Window Film",
                serviceCategory: "Thermal Insulation Window Film",
                parts: service.parts,
                carSize: service.carSize,
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

        console.log(`✅ تم إنشاء ${windowFilmServices.length} خدمة Window Film`);

        // 5. إنشاء خدمات إضافية
        const additionalServices = [
            { name: "Small Screen", price: 3000, remarks: "" },
            { name: "Large Screen", price: 5000, remarks: "" },
            { name: "Interior Leather Protection", price: 9000, remarks: "Per Bottle" },
            { name: "Soft Top Leather Protection", price: 10000, remarks: "Per Bottle" },
            { name: "Plexi", price: 5000, remarks: "" },
            { name: "Plexi Plus", price: 14000, remarks: "" }
        ];

        for (const service of additionalServices) {
            await db.create('products', {
                name: service.name,
                type: "Additional Services",
                serviceCategory: "Additional Services",
                remarks: service.remarks,
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

        console.log(`✅ تم إنشاء ${additionalServices.length} خدمة إضافية`);

        console.log('\n🎉 اكتمل إعداد فئات الخدمات والأسعار!');
        console.log(`📊 إجمالي المنتجات الجديدة: ${(serviceCategories[0].subcategories.length + serviceCategories[1].subcategories.length) + windowFilmServices.length + additionalServices.length}`);
        
    } catch (error) {
        console.error('❌ خطأ في إعداد الخدمات:', error.message);
    }
}

// تنفيذ عملية الإعداد
setupServiceCategories().then(() => {
    console.log('\n✨ جاهز للتعديل على صفحات المبيعات!');
    process.exit(0);
}).catch(error => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
});
