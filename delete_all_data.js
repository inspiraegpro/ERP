const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function deleteAllData() {
    console.log('⚠️  DELETING ALL DATA - THIS CANNOT BE UNDONE ⚠️\n');
    
    try {
        // Delete stocktransactions
        const stockCount = await db.countDocuments('stocktransactions');
        await db.deleteMany('stocktransactions', {});
        console.log(`✅ Deleted ${stockCount} stock transactions`);
        
        // Delete servicejobs
        const jobsCount = await db.countDocuments('servicejobs');
        await db.deleteMany('servicejobs', {});
        console.log(`✅ Deleted ${jobsCount} service jobs`);
        
        // Delete salesinvoices
        const invoicesCount = await db.countDocuments('salesinvoices');
        await db.deleteMany('salesinvoices', {});
        console.log(`✅ Deleted ${invoicesCount} sales invoices`);
        
        console.log('\n✅ All data deleted successfully');
        console.log('Backup is available in: ./backup_2026-05-07T12-58-19-873Z');
        
    } catch (error) {
        console.error('Error during deletion:', error);
    }
}

deleteAllData();
