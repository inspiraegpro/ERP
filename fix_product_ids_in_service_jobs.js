const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function fixServiceJobProductIds() {
    console.log('Starting fix for service job product IDs...');
    
    try {
        // Get all service jobs
        const jobs = await db.find('servicejobs');
        console.log(`Found ${jobs.length} service jobs`);
        
        let fixedCount = 0;
        let errorCount = 0;
        
        // Get all products for reference
        const products = await db.find('products');
        console.log(`Found ${products.length} products`);
        
        // Create a map for quick lookup by code/inventorySlug/name
        const productMap = new Map();
        products.forEach(p => {
            if (p.code) productMap.set(p.code.toLowerCase(), p._id);
            if (p.inventorySlug) productMap.set(p.inventorySlug.toLowerCase(), p._id);
            if (p.name) productMap.set(p.name.toLowerCase(), p._id);
        });
        
        for (const job of jobs) {
            if (!job.items || job.items.length === 0) continue;
            
            let needsUpdate = false;
            const updatedItems = job.items.map(item => {
                if (!item.product) return item;
                
                // If product is already a valid ID, keep it
                if (typeof item.product === 'string' && item.product.length > 10) {
                    return item;
                }
                
                // Try to find the real product ID
                const productKey = String(item.product).toLowerCase();
                const realProductId = productMap.get(productKey);
                
                if (realProductId) {
                    console.log(`Fixing job ${job.jobOrder || job._id}: ${item.product} -> ${realProductId}`);
                    needsUpdate = true;
                    return {
                        ...item,
                        product: realProductId
                    };
                }
                
                return item;
            });
            
            if (needsUpdate) {
                await db.updateOne('servicejobs', { _id: job._id }, { items: updatedItems });
                fixedCount++;
            }
        }
        
        console.log(`\nSummary:`);
        console.log(`- Total jobs checked: ${jobs.length}`);
        console.log(`- Jobs fixed: ${fixedCount}`);
        console.log(`- Jobs with errors: ${errorCount}`);
        console.log('Fix completed!');
        
    } catch (error) {
        console.error('Error during fix:', error);
    }
}

fixServiceJobProductIds();
