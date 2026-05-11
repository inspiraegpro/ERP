const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function findPPFProduct() {
    console.log('Searching for PPF products...\n');
    
    try {
        const products = await db.find('products');
        console.log(`Found ${products.length} products\n`);
        
        const ppfProducts = products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            const slug = (p.inventorySlug || '').toLowerCase();
            return name.includes('ppf') || code.includes('ppf') || slug.includes('ppf');
        });
        
        console.log(`Found ${ppfProducts.length} PPF-related products:\n`);
        
        ppfProducts.forEach(p => {
            console.log(`- ID: ${p._id}`);
            console.log(`  Name: ${p.name}`);
            console.log(`  Code: ${p.code}`);
            console.log(`  InventorySlug: ${p.inventorySlug}`);
            console.log(`  Category: ${p.category}`);
            console.log(`  Type: ${p.type}`);
            console.log(`  ServiceCategory: ${p.serviceCategory}`);
            console.log(`  LinkedInventoryCodes: ${p.linkedInventoryCodes?.join(', ') || 'none'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

findPPFProduct();
