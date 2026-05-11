const fs = require('fs');
const readline = require('readline');
const Account = require('./models/Account');

async function run() {
    console.log("Clearing existing accounts...");
    await Account.deleteMany({}); 
    
    console.log("Reading CSV...");
    const fileStream = fs.createReadStream('./يلا/شجرة حسابات 2025.csv', { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isFirst = true;
    let count = 0;
    for await (const line of rl) {
        if (isFirst) { isFirst = false; continue; }
        if (!line.trim()) continue;
        const parts = line.split(',');
        const [code, is_transactional, name, nature, parent_id, type] = parts;
        await Account.create({
            code: code.trim(),
            isTransactional: is_transactional === 'TRUE',
            name: name.trim(),
            nature: nature ? nature.trim() : '',
            parentId: parent_id ? parent_id.trim() : null,
            type: type ? type.trim() : '',
            balance: 0
        });
        count++;
    }
    console.log(`Finished importing ${count} accounts.`);
}
run().catch(console.error);
