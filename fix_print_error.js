const fs = require('fs');
let html = fs.readFileSync('public/sales_invoice.html', 'utf8');

// Fix print button
const regexPrint = /<button class="btn btn-secondary" onclick="window\.print\(\)">طباعة<\/button>/;
const replacePrint = `<button class="btn btn-secondary" type="button" onclick="alert('برجاء حفظ الفاتورة بالأسفل ليتم توجيهك لشاشة الطباعة الرسمية.')"><i class="fa-solid fa-print"></i> طباعة</button>`;
html = html.replace(regexPrint, replacePrint);

// Fix error message handling in save
const regexError = /alert\('خطأ أثناء الحفظ: ' \+ \(err\.message \|\| 'خطأ غير معروف'\)\);/;
const replaceError = `alert('خطأ أثناء الحفظ: ' + (err.message || err.error || JSON.stringify(err) || 'خطأ غير معروف')); console.error('Save Error:', err);`;
html = html.replace(regexError, replaceError);

fs.writeFileSync('public/sales_invoice.html', html);
console.log('Fixed Print Button and Error message in sales_invoice!');
