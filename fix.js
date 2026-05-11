const fs = require('fs');
let content = fs.readFileSync('public/sales_invoice.html', 'utf8');

content = content.replace("    }\r\n    }\r\n\r\n    function populateCarParts() {", "    }\r\n\r\n    function populateCarParts() {");
content = content.replace("    }\n    }\n\n    function populateCarParts() {", "    }\n\n    function populateCarParts() {");

fs.writeFileSync('public/sales_invoice.html', content);
console.log("Syntax error fixed");
