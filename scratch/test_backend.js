const FileDbManager = require('./file_db_manager');
const InventoryPiece = require('./Models/InventoryPiece');

async function debugInventory() {
    try {
        console.log('--- DB Manager Check ---');
        const db = new FileDbManager();
        const rolls = await db.find('rollbalances');
        console.log('Total Rolls in DB:', rolls ? rolls.length : 0);
        
        const p2Rolls = (rolls || []).filter(r => 
            String(r.productName || '').toLowerCase().includes('p2')
        );
        console.log('P2 Rolls:', p2Rolls.length);
        if (p2Rolls.length > 0) {
            console.log('P2 Status:', p2Rolls[0].status);
        }

        console.log('\n--- Suggestions Engine Check ---');
        // Simulate getting suggestions for p2 with 1m2 area
        const suggestions = await InventoryPiece.getSmartSuggestions('p2', 1);
        console.log('Suggestions Count for P2:', suggestions.length);
        console.log('Suggestions:', JSON.stringify(suggestions, null, 2));

    } catch (error) {
        console.error('DEBUG ERROR:', error);
    }
}

debugInventory();
