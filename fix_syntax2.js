const fs = require('fs');
let html = fs.readFileSync('public/sales_invoice.html', 'utf8');

const regex = /try {\s*const res = await fetch\(url, \{ method: method, headers: authHeaders\(true\), body:JSON\.stringify\(data\) \}\);\s*let data = \[\];\s*data\.push\(\["فاتورة مبيعات"\]\);\s*data\.push\(\\["رقم الفاتورة", invNum\\]\); \/\/ هنا/g;

// Fallback search if previous one didn't match
if(!html.match(/try \{\s*const res = await fetch\(url, \{ method/)) {
     console.log("Not found with exact match, finding general block");
}

let modified = false;

const newBlock = `try {
            const res = await fetch(url, { method: method, headers: authHeaders(true), body: JSON.stringify(data) });
            if(res.ok) {
                alert('تم حفظ الفاتورة بنجاح!');
                window.location.href = 'service_jobs.html';
            } else {
                const err = await res.json();
                alert('خطأ أثناء الحفظ: ' + (err.message || 'خطأ غير معروف'));
            }
        } catch(e) {
            alert('خطأ في الاتصال بالخادم: ' + e.message);
        }
    }

    function exportToExcel() {
        const invNum = document.getElementById('invNum').value;
        const customer = document.getElementById('customer').options[document.getElementById('customer').selectedIndex]?.text || '';
        const car = document.getElementById('car').options[document.getElementById('car').selectedIndex]?.text || '';
        const date = document.getElementById('date').value;

        let data = [];
        data.push(["فاتورة مبيعات"]);
        data.push(["رقم الفاتورة", invNum]); // هنا`;

html = html.replace(/try {\s*const res = await fetch\(url, \{ method: method, headers: authHeaders\(true\), body:JSON\.stringify\(data\) \}\);\s*let data = \[\];\s*data\.push\(\["فاتورة مبيعات"\]\);\s*data\.push\(\["رقم الفاتورة", invNum\]\); \/\/ هنا/, newBlock);

fs.writeFileSync('public/sales_invoice.html', html);
console.log("Regex Replace Run!");
