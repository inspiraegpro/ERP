const fs = require('fs');
let html = fs.readFileSync('public/sales_invoice.html', 'utf8');

// 1. Add TomSelect CDN
if (!html.includes('tom-select')) {
    html = html.replace('</head>', '<link href="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js"></script></head>');
}

// 2. Change Salesperson label (Mandoon/Commissions)
html = html.replace(/موظف المبيعات/g, 'مندوب المبيعات / العمولات');
html = html.replace(/إضافة موظف مبيعات/g, 'إضافة مستفيد للعمولات');
html = html.replace(/اسم الموظف/g, 'اسم المندوب');

// 3. Fix Print Button: redirect if saved, else alert
const printBtnRegex = /<button class="btn btn-secondary" type="button" onclick="[^"]+"><i class="fa-solid fa-print"><\/i> طباعة<\/button>/;
const newPrintBtn = `<button class="btn btn-secondary" type="button" onclick="const eId = document.getElementById('editId').value; if(eId) { window.open('invoice_print.html?id=' + eId); } else { alert('برجاء حفظ الفاتورة أولاً ليتم الطباعة!'); }"><i class="fa-solid fa-print"></i> طباعة معتمدة</button>`;
html = html.replace(printBtnRegex, newPrintBtn);

html = html.replace(/<button class="btn btn-secondary" onclick="window\.print\(\)">طباعة<\/button>/g, newPrintBtn);

// 4. Change '<input class="part-name"' to have list="parts-datalist"
html = html.replace(/<input class="part-name" value="\$\{d\.partName\|\|''\}" placeholder="اسم القطعة">/g, '`<input class="part-name" value="${d.partName||\'\'}" placeholder="اسم القطعة" list="parts-datalist">`');

// 5. Append datalist and TomSelect init scripts after loading data
const scriptEndRegex = /if\(salesSel\) \{[\s\S]*?\}\s*\} catch\(e\) \{/;
const replaceScriptEnd = `
            if(salesSel) {
                employees.forEach(e => {
                    salesSel.innerHTML += \`<option value="\${e._id}">\${e.name || e.code}</option>\`;
                });
            }

            // Populate Datalist for Parts
            const datalist = document.getElementById('parts-datalist') || document.createElement('datalist');
            datalist.id = 'parts-datalist';
            const uniqueParts = new Set();
            carsData.forEach(c => {
               if(c.parts) c.parts.forEach(p => uniqueParts.add(p.name));
            });
            datalist.innerHTML = '';
            uniqueParts.forEach(p => {
               const opt = document.createElement('option');
               opt.value = p;
               datalist.appendChild(opt);
            });
            document.body.appendChild(datalist);

            // Init Searchable Dropdowns
            setTimeout(() => {
                if(window.carSelect) window.carSelect.destroy();
                if(window.custSelect) window.custSelect.destroy();
                if(window.salesSelect) window.salesSelect.destroy();
                
                window.carSelect = new TomSelect('#car', { create: false, sortField: { field: 'text' } });
                window.custSelect = new TomSelect('#customer', { create: false });
                if(document.getElementById('salesPerson')) window.salesSelect = new TomSelect('#salesPerson', { create: false });
            }, 300);

        } catch(e) {`;

html = html.replace(scriptEndRegex, replaceScriptEnd);

// Also need to un-TomSelect and re-TomSelect when user adds completely new item inline
// Wait, the "Add Customer" modal appends to HTML and we need to sync TomSelect!
const addCustRegex = /s\.value = c\._id;/;
const addCustReplace = `s.value = c._id;
            if(window.custSelect) {
                window.custSelect.addOption({value: c._id, text: c.name});
                window.custSelect.addItem(c._id);
            }`;
html = html.replace(addCustRegex, addCustReplace);

const addEmpRegex = /s\.value = c\._id;[\s]*document\.getElementById\('quickEmpModal'\)\.style\.display = 'none';/;
const addEmpReplace = `s.value = c._id;
            if(window.salesSelect) {
                window.salesSelect.addOption({value: c._id, text: c.name});
                window.salesSelect.addItem(c._id);
            }
            document.getElementById('quickEmpModal').style.display = 'none';`;
html = html.replace(addEmpRegex, addEmpReplace);


fs.writeFileSync('public/sales_invoice.html', html);
console.log('Done modifying sales_invoice.html');
