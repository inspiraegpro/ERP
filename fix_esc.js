const fs = require('fs');
let text = fs.readFileSync('public/price_list.html', 'utf8');
text = text.replace(/\\\`/g, '`');
text = text.replace(/\\\$/g, '$');
fs.writeFileSync('public/price_list.html', text);
console.log('Fixed Escaping!');
