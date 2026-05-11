const Product = require('./models/Product');
async function run() {
    const products = await Product.find({});
    console.log(`Total Products: ${products.length}`);
    const types = new Set();
    const pieces = [];
    for (const p of products) {
        if (p.type) types.add(p.type);
        if (p.unit && (p.unit.includes('قطعة') || p.unit.toLowerCase() === 'piece')) {
            pieces.push({ name: p.name, type: p.type, unit: p.unit });
        }
    }
    console.log("Distinct Types:", Array.from(types));
    console.log("Sample Pieces (first 10):", pieces.slice(0, 10));
}
run().catch(console.error);
