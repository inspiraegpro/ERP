const FileDatabaseManager = require('./file_db_manager');

const db = new FileDatabaseManager();

async function updateJobStatus() {
    console.log('Updating job status for INV-00003...\n');
    
    try {
        // Find the job linked to INV-00003
        const job = await db.findOne('servicejobs', { jobOrder: 'INV-00003' });
        if (!job) {
            console.log('Job with jobOrder INV-00003 not found');
            return;
        }
        
        console.log(`Job found: ${job._id}`);
        console.log(`Current status: ${job.status}`);
        console.log(`Current workflowStatus: ${job.workflowStatus}`);
        
        // Update the job status
        await db.updateOne('servicejobs', { _id: job._id }, {
            status: 'IN_PROGRESS',
            workflowStatus: 'IssuedToTechnician'
        });
        
        console.log('\n✅ Job status updated successfully');
        console.log('New status: IN_PROGRESS');
        console.log('New workflowStatus: IssuedToTechnician');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

updateJobStatus();
