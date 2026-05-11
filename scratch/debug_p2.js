const FileDbManager = require('../file_db_manager');
const rollDb = new FileDbManager('rollbalances');
const pieceDb = new FileDbManager('inventory_pieces');

async function testQuery() {
    console.log('--- Checking Rolls for p2 ---');
    const rolls = await rollDb.findAll('rollbalances');
    const p2Rolls = rolls.filter(r => 
        String(r.productName || '').toLowerCase().includes('p2') || 
        String(r.productCode || '').toLowerCase().includes('p2')
    );
    console.log(`Found ${p2Rolls.length} rolls for p2`);
    if (p2Rolls.length > 0) {
        console.log('Sample Roll:', JSON.stringify(p2Rolls[0], null, 2));
    }

    console.log('\n--- Checking Pieces for p2 ---');
    const pieces = await pieceDb.findAll('inventory_pieces');
    const p2Pieces = pieces.filter(p => 
        String(p.productName || '').toLowerCase().includes('p2') || 
        String(p.productCode || '').toLowerCase().includes('p2')
    );
    console.log(`Found ${p2Pieces.length} pieces for p2`);
}

testQuery();
