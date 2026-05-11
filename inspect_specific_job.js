const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function inspectJob(jobId) {
    console.log(`Inspecting job: ${jobId}\n`);
    
    try {
        const job = await db.findOne('servicejobs', { _id: jobId });
        if (!job) {
            console.log('Job not found!');
            return;
        }
        
        console.log('Job data:');
        console.log(`- _id: ${job._id}`);
        console.log(`- jobOrder: ${job.jobOrder}`);
        console.log(`- status: ${job.status}`);
        console.log(`- workflowStatus: ${job.workflowStatus}`);
        console.log(`- salesInvoiceId: ${job.salesInvoiceId}`);
        console.log(`- items count: ${job.items?.length || 0}`);
        
        if (job.items && job.items.length > 0) {
            console.log('\nItems:');
            job.items.forEach((item, idx) => {
                console.log(`\nItem ${idx}:`);
                console.log(`  product: ${item.product} (type: ${typeof item.product})`);
                console.log(`  productData: ${item.productData ? JSON.stringify(item.productData) : 'undefined'}`);
                console.log(`  partName: ${item.partName}`);
                console.log(`  materialCategory: ${item.materialCategory}`);
                console.log(`  lengthCM: ${item.lengthCM}`);
                console.log(`  widthCM: ${item.widthCM}`);
                console.log(`  area: ${item.area}`);
            });
        } else {
            console.log('\nNo items in this job');
        }
        
        // Check if there's a linked invoice
        if (job.salesInvoiceId) {
            console.log('\n\nChecking linked invoice...');
            const invoice = await db.findOne('salesinvoices', { _id: job.salesInvoiceId });
            if (invoice) {
                console.log(`Invoice found: ${invoice.invoiceNumber}`);
                console.log(`Invoice items count: ${invoice.items?.length || 0}`);
                if (invoice.items && invoice.items.length > 0) {
                    console.log('\nInvoice items:');
                    invoice.items.forEach((item, idx) => {
                        console.log(`\nInvoice Item ${idx}:`);
                        console.log(`  product: ${item.product} (type: ${typeof item.product})`);
                        console.log(`  productName: ${item.productName}`);
                        console.log(`  partName: ${item.partName}`);
                        console.log(`  category: ${item.category}`);
                        console.log(`  materialCategory: ${item.materialCategory}`);
                    });
                }
            } else {
                console.log('Invoice not found');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectJob('movbujholdyydqll93');
