const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function inspectServiceJobs() {
    console.log('Inspecting service jobs...');
    
    try {
        const jobs = await db.find('servicejobs');
        console.log(`\nFound ${jobs.length} service jobs\n`);
        
        for (const job of jobs) {
            console.log(`\n=== Job: ${job.jobOrder || job._id} ===`);
            console.log(`Items count: ${job.items?.length || 0}`);
            
            if (job.items && job.items.length > 0) {
                job.items.forEach((item, idx) => {
                    console.log(`\nItem ${idx}:`);
                    console.log(`  product: ${item.product} (type: ${typeof item.product})`);
                    console.log(`  productData: ${item.productData ? 'exists' : 'undefined'}`);
                    console.log(`  partName: ${item.partName}`);
                    console.log(`  materialCategory: ${item.materialCategory}`);
                });
            }
        }
        
        // Also check products
        const products = await db.find('products');
        console.log(`\n\n=== Products ===`);
        console.log(`Found ${products.length} products`);
        products.slice(0, 5).forEach(p => {
            console.log(`- ${p.name} (ID: ${p._id}, code: ${p.code}, inventorySlug: ${p.inventorySlug})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectServiceJobs();
