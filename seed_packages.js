const FileDatabaseManager = require('./file_db_manager');
const db = new FileDatabaseManager();

const items = [
    // Sedan
    { code: 'PKG-SED-001', name: 'Sedan - 2 Doors', type: 'باقات سيدان', unit: 'قطعة', price: 4000 },
    { code: 'PKG-SED-002', name: 'Sedan - 4 Doors', type: 'باقات سيدان', unit: 'قطعة', price: 8000 },
    { code: 'PKG-SED-003', name: 'Sedan - Front Windshield', type: 'باقات سيدان', unit: 'قطعة', price: 4000 },
    { code: 'PKG-SED-004', name: 'Sedan - Rear Windshield', type: 'باقات سيدان', unit: 'قطعة', price: 4000 },
    { code: 'PKG-SED-005', name: 'Sedan - Sunroof', type: 'باقات سيدان', unit: 'قطعة', price: 4000 },
    { code: 'PKG-SED-006', name: 'Sedan - Full Glass Roof', type: 'باقات سيدان', unit: 'قطعة', price: 6000 },
    { code: 'PKG-SED-007', name: 'Sedan - Half Package', type: 'باقات سيدان', unit: 'قطعة', price: 7000 },
    { code: 'PKG-SED-008', name: 'Sedan - Full Package', type: 'باقات سيدان', unit: 'قطعة', price: 14000 },
    { code: 'PKG-SED-009', name: 'Sedan - Full Package + Sunroof', type: 'باقات سيدان', unit: 'قطعة', price: 16000 },
    { code: 'PKG-SED-010', name: 'Sedan - Full Package + Full Roof', type: 'باقات سيدان', unit: 'قطعة', price: 18000 },

    // SUV / Large Sedan
    { code: 'PKG-SUV-001', name: 'SUV/Large Sedan - 2 Doors', type: 'باقات SUV', unit: 'قطعة', price: 4000 },
    { code: 'PKG-SUV-002', name: 'SUV/Large Sedan - 4 Doors', type: 'باقات SUV', unit: 'قطعة', price: 8000 },
    { code: 'PKG-SUV-003', name: 'SUV/Large Sedan - Front Windshield', type: 'باقات SUV', unit: 'قطعة', price: 5000 },
    { code: 'PKG-SUV-004', name: 'SUV/Large Sedan - Rear Windshield', type: 'باقات SUV', unit: 'قطعة', price: 5000 },
    { code: 'PKG-SUV-005', name: 'SUV/Large Sedan - Sunroof', type: 'باقات SUV', unit: 'قطعة', price: 5000 },
    { code: 'PKG-SUV-006', name: 'SUV/Large Sedan - Full Glass Roof', type: 'باقات SUV', unit: 'قطعة', price: 7000 },
    { code: 'PKG-SUV-007', name: 'SUV/Large Sedan - Half Package', type: 'باقات SUV', unit: 'قطعة', price: 8000 },
    { code: 'PKG-SUV-008', name: 'SUV/Large Sedan - Full Package', type: 'باقات SUV', unit: 'قطعة', price: 16000 },
    { code: 'PKG-SUV-009', name: 'SUV/Large Sedan - Full Package + Sunroof', type: 'باقات SUV', unit: 'قطعة', price: 19000 },
    { code: 'PKG-SUV-010', name: 'SUV/Large Sedan - Full Package + Full Roof', type: 'باقات SUV', unit: 'قطعة', price: 21000 },

    // Large SUV
    { code: 'PKG-LSUV-001', name: 'Large SUV - 2 Doors', type: 'باقات الجيب', unit: 'قطعة', price: 4000 },
    { code: 'PKG-LSUV-002', name: 'Large SUV - 4 Doors', type: 'باقات الجيب', unit: 'قطعة', price: 8000 },
    { code: 'PKG-LSUV-003', name: 'Large SUV - Front Windshield', type: 'باقات الجيب', unit: 'قطعة', price: 5000 },
    { code: 'PKG-LSUV-004', name: 'Large SUV - Rear Windshield', type: 'باقات الجيب', unit: 'قطعة', price: 5000 },
    { code: 'PKG-LSUV-005', name: 'Large SUV - Sunroof', type: 'باقات الجيب', unit: 'قطعة', price: 6000 },
    { code: 'PKG-LSUV-006', name: 'Large SUV - Full Glass Roof', type: 'باقات الجيب', unit: 'قطعة', price: 8000 },
    { code: 'PKG-LSUV-007', name: 'Large SUV - Half Package', type: 'باقات الجيب', unit: 'قطعة', price: 8000 },
    { code: 'PKG-LSUV-008', name: 'Large SUV - Full Package', type: 'باقات الجيب', unit: 'قطعة', price: 16000 },
    { code: 'PKG-LSUV-009', name: 'Large SUV - Full Package + Sunroof', type: 'باقات الجيب', unit: 'قطعة', price: 20000 },
    { code: 'PKG-LSUV-010', name: 'Large SUV - Full Package + Full Roof', type: 'باقات الجيب', unit: 'قطعة', price: 22000 },

    // Additional Services / Screens
    { code: 'SVC-SCR-001', name: 'Small Screen', type: 'شاشات', unit: 'قطعة', price: 3000 },
    { code: 'SVC-SCR-002', name: 'Large Screen', type: 'شاشات', unit: 'قطعة', price: 5000 },

    // Liquids / Protection
    { code: 'SVC-LTH-001', name: 'Interior Leather Protection', type: 'مواد حماية', unit: 'زجاجة', price: 9000 },
    { code: 'SVC-LTH-002', name: 'Soft Top Leather Protection', type: 'مواد حماية', unit: 'زجاجة', price: 10000 },

    // Plexi
    { code: 'SVC-PLX-001', name: 'Plexi', type: 'حماية بليكسي', unit: 'قطعة', price: 5000 },
    { code: 'SVC-PLX-002', name: 'Plexi Plus', type: 'حماية بليكسي', unit: 'قطعة', price: 14000 }
];

async function seed() {
    for (const item of items) {
        const existing = await db.findOne('products', { code: item.code });
        
        const payload = {
            code: item.code,
            name: item.name,
            type: item.type,
            unit: item.unit,
            dimensions: {
                length: 0,
                width: 0,
                area: 0
            },
            pricing: {
                salePrice: item.price,
                unitSalePrice: item.price
            },
            currentStock: 100, // Giving some stock so it can be sold
            salesAccountCode: "410101",
            cogsAccountCode: "5102"
        };

        if (existing) {
            await db.updateOne('products', { code: item.code }, payload);
            console.log("Updated", item.name);
        } else {
            await db.create('products', payload);
            console.log("Created", item.name);
        }
    }
    console.log("Done inserting all items.");
}

seed();
