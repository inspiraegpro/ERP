const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function fixInvoiceProductIds() {
    console.log('Fixing invoice product IDs...\n');
    
    try {
        // Get the invoice
        const invoice = await db.findOne('salesinvoices', { invoiceNumber: 'INV-00001' });
        if (!invoice) {
            console.log('Invoice INV-00001 not found');
            return;
        }
        
        console.log(`Invoice found: ${invoice.invoiceNumber}`);
        console.log(`Items count: ${invoice.items?.length}`);
        
        // Find the PPF product ID
        const ppfProduct = await db.findOne('products', { name: 'PPF' });
        if (!ppfProduct) {
            console.log('PPF product not found');
            return;
        }
        
        console.log(`\nPPF Product ID: ${ppfProduct._id}`);
        
        // Fix the invoice items
        const updatedItems = invoice.items.map(item => ({
            ...item,
            product: ppfProduct._id
        }));
        
        // Update the invoice
        await db.updateOne('salesinvoices', { _id: invoice._id }, { items: updatedItems });
        console.log('\n✅ Invoice updated successfully');
        
        // Now sync the service job from the invoice
        const job = await db.findOne('servicejobs', { salesInvoiceId: invoice._id });
        if (job) {
            console.log(`\nFound linked job: ${job._id}`);
            
            // Update job items from invoice
            const jobItems = updatedItems.map(item => ({
                ...item,
                partName: item.partName || item.productName || item.description || '',
                materialCategory: 'PPF',
                lengthCM: item.lengthCM || item.length || 0,
                widthCM: item.widthCM || item.width || 0,
                area: item.area || 0,
                issueStatus: 'Pending',
                product: ppfProduct._id
            }));
            
            await db.updateOne('servicejobs', { _id: job._id }, { items: jobItems });
            console.log('✅ Service job updated successfully');
        }
        
        console.log('\n✅ Fix completed!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixInvoiceProductIds();
