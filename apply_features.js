const fs = require('fs');
let html = fs.readFileSync('public/sales_invoice.html', 'utf8');

// 1. Add Car Category to the top row
const regexRow1 = /<div class="row">\s*<div class="col" style="flex:1\.2;">\s*<label style="display:flex; justify-content:space-between">\s*العميل/;
const replaceRow1 = `<div class="row">
        <div class="col" style="flex:1;">
            <label>تصنيف السيارة</label>
            <select id="carCategory" onchange="rebuildAllRowsOpts()">
                <option value="">-- كل التصنيفات --</option>
                <option value="باقات سيدان">Sedan</option>
                <option value="باقات SUV">SUV/Large Sedan</option>
                <option value="باقات الجيب">Large SUV</option>
            </select>
        </div>
        <div class="col" style="flex:1.2;">
            <label style="display:flex; justify-content:space-between">
                العميل`;
html = html.replace(regexRow1, replaceRow1);

// 2. Change + عميل جديد to modal call
html = html.replace(/<a href="customers\.html" target="_blank" [^>]*>\+ عميل جديد<\/a>/, `<a href="#" onclick="openQuickCustomerModal(); return false;" style="font-size:11px; color:#3b82f6; text-decoration:none;">+ عميل جديد سريع</a>`);

// 3. Make SalesPerson have + جديد
const regexSales = /<label>موظف المبيعات<\/label>/;
const replaceSales = `<label style="display:flex; justify-content:space-between">موظف المبيعات <a href="#" onclick="openQuickEmpModal(); return false;" style="font-size:11px; color:#3b82f6; text-decoration:none;">+ جديد</a></label>`;
html = html.replace(regexSales, replaceSales);

// 4. Change res.ok in saveInvoice to redirect to invoice_print
const regexSave = /if\(res\.ok\) \{\s*alert\('تم حفظ الفاتورة بنجاح!'\);\s*window\.location\.href = 'service_jobs\.html';\s*\}/;
const replaceSave = `if(res.ok) {
                const savedInv = await res.json();
                alert('تم حفظ الفاتورة بنجاح!');
                window.location.href = 'invoice_print.html?id=' + savedInv._id;
            }`;
html = html.replace(regexSave, replaceSave);

// 5. Update createRow to filter opts by carCategory
const regexCreateOpts = /let opts = '<option value="">اختر الخامة<\/option>';\s*products\.forEach\(p => /;
const replaceCreateOpts = `let opts = '<option value="">اختر الخامة</option>';
        const cat = document.getElementById('carCategory')?.value;
        const filteredProducts = cat ? products.filter(p => !p.type?.includes('باقات') || p.type === cat) : products;
        filteredProducts.forEach(p => `;
html = html.replace(regexCreateOpts, replaceCreateOpts);

// 6. Insert Modal HTML & JS before </body>
const quickModals = `
<!-- Quick Modals -->
<div id="quickCustModal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
    <div style="background:#fff; padding:20px; border-radius:10px; width:400px; max-width:90%;">
        <h3 style="margin-top:0">إضافة عميل سريع</h3>
        <label>اسم العميل</label>
        <input type="text" id="qcName" style="margin-bottom:15px">
        <label>رقم الجوال</label>
        <input type="text" id="qcPhone" style="margin-bottom:15px">
        <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn btn-list" onclick="document.getElementById('quickCustModal').style.display='none'">إلغاء</button>
            <button class="btn btn-success" onclick="saveQuickCust()">حفظ</button>
        </div>
    </div>
</div>

<div id="quickEmpModal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
    <div style="background:#fff; padding:20px; border-radius:10px; width:400px; max-width:90%;">
        <h3 style="margin-top:0">إضافة موظف مبيعات</h3>
        <label>اسم الموظف</label>
        <input type="text" id="qeName" style="margin-bottom:15px">
        <div style="display:flex; gap:10px; justify-content:flex-end">
            <button class="btn btn-list" onclick="document.getElementById('quickEmpModal').style.display='none'">إلغاء</button>
            <button class="btn btn-success" onclick="saveQuickEmp()">حفظ</button>
        </div>
    </div>
</div>
<script>
    function openQuickCustomerModal() { document.getElementById('quickCustModal').style.display = 'flex'; }
    async function saveQuickCust() {
        const name = document.getElementById('qcName').value.trim();
        const phone = document.getElementById('qcPhone').value.trim();
        if(!name) return alert('أدخل الاسم');
        try {
            const res = await fetch(API+'/customers', {
                method: 'POST', headers: authHeaders(true),
                body: JSON.stringify({ name, phone })
            });
            const c = await res.json();
            const s = document.getElementById('customer');
            s.innerHTML += \`<option value="\${c._id}">\${c.name}</option>\`;
            s.value = c._id;
            document.getElementById('quickCustModal').style.display = 'none';
        } catch(e) { alert('خطأ'); }
    }

    function openQuickEmpModal() { document.getElementById('quickEmpModal').style.display = 'flex'; }
    async function saveQuickEmp() {
        const name = document.getElementById('qeName').value.trim();
        if(!name) return alert('أدخل الاسم');
        try {
            // Employee schema basic insert
            const payload = {
                code: 'EMP-' + Date.now().toString().slice(-4),
                name, primaryRole: 'Sales', active: true
            };
            const res = await fetch(API+'/hr/employees', {
                method: 'POST', headers: authHeaders(true),
                body: JSON.stringify(payload)
            });
            const c = await res.json();
            const s = document.getElementById('salesPerson');
            s.innerHTML += \`<option value="\${c._id}">\${c.name}</option>\`;
            s.value = c._id;
            document.getElementById('quickEmpModal').style.display = 'none';
        } catch(e) { alert('خطأ'); }
    }

    function rebuildAllRowsOpts() {
        const cat = document.getElementById('carCategory')?.value;
        const filteredProducts = cat ? products.filter(p => !p.type?.includes('باقات') || p.type === cat) : products;
        let opts = '<option value="">اختر الخامة</option>';
        filteredProducts.forEach(p => opts += \`<option value="\${p._id}" data-price="\${p.pricing?.salePrice || p.pricing?.unitSalePrice || 0}" data-unit="\${p.unit||'ROLL'}">\${p.name}</option>\`);
        document.querySelectorAll('.prod').forEach(select => {
            const val = select.value;
            select.innerHTML = opts;
            select.value = val; // Try to retain previous selection if it still exists
            updPrice(select);
        });
    }
</script>
`;
html = html.replace('</body>', quickModals + '\n</body>');

fs.writeFileSync('public/sales_invoice.html', html);
console.log("Features Applied!");
