const fs = require('fs');
let content = fs.readFileSync('public/sales_invoice.html', 'utf8');

// 1. Update Invoice Number
content = content.replace(
    /<input type="text" id="invNum" style="width: 200px; border: 1px dashed #666;" placeholder="اكتب الرقم أو اتركه للتلقائي" style="color:#2563eb; font-weight:bold;">/g,
    '<input type="text" id="invNum" style="width: 200px; background-color:#f1f5f9; border: 1px solid #cbd5e1;" placeholder="يتم تعيينه تلقائياً عند الحفظ" readonly class="readonly-input">'
);

// 2. Update grid row
const oldGridRaw = `<div class="row">
        <div class="col">
            <label>العميل</label>
            <select id="customer"><option value="">-- اختر العميل --</option></select>
        </div>
        <div class="col">
            <label>السيارة</label>
            <select id="car" onchange="populateCarParts()"><option value="">-- اختر لتنزيل القطع --</option></select>
        </div>
        <div class="col">
            <label>نوع الخدمة</label>
            <select id="serviceType"><option value="تغليف كامل">تغليف كامل</option><option value="حماية">حماية (PPF)</option><option value="تلميع">تلميع</option><option value="عازل">عازل حراري</option></select>
        </div>
    </div>`;

const newGridRaw = `<div class="row">
        <div class="col" style="flex:1.2;">
            <label style="display:flex; justify-content:space-between">
                العميل
                <a href="customers.html" target="_blank" style="font-size:11px; color:#3b82f6; text-decoration:none;">+ عميل جديد</a>
            </label>
            <select id="customer"><option value="">-- اختر العميل --</option></select>
            <button class="btn btn-list no-print" style="padding:4px 8px; font-size:10px; margin-top:5px; width:100%" onclick="refreshCustomers()">🔄 استرجاع العملاء</button>
        </div>
        <div class="col" style="flex:1.2;">
            <label>السيارة</label>
            <select id="car" onchange="populateCarParts()"><option value="">-- اختر لتنزيل القطع --</option></select>
        </div>
        <div class="col" style="flex:1.2;">
            <label style="display:flex; justify-content:space-between">
                نوع الخدمة
                <a href="#" onclick="addServiceType(); return false;" style="font-size:11px; color:#3b82f6; text-decoration:none;">+ تصنيف جديد</a>
            </label>
            <select id="serviceType">
                <option value="تغليف كامل">تغليف كامل</option>
                <option value="حماية">حماية (PPF)</option>
                <option value="تلميع">تلميع</option>
                <option value="عازل">عازل حراري</option>
            </select>
        </div>
        <div class="col" style="flex:1.2;">
            <label>موظف المبيعات</label>
            <select id="salesPerson"><option value="">-- اختر الموظف --</option></select>
        </div>
    </div>`;

// Using split/join to replace raw strings safely across DOS lines if possible, or simple replace
content = content.replace(oldGridRaw, newGridRaw);
// Fallback if previous simple replace failed due to line endings
if (!content.includes('salesPerson')) {
    const rowRegex = /<div class="row">[\s\S]*?-- اختر العميل --[\s\S]*?-- اختر لتنزيل القطع --[\s\S]*?تغليف كامل[\s\S]*?<\/div>\s*<\/div>/;
    content = content.replace(rowRegex, newGridRaw);
}

// 3. Update loadData
const loadDataRegex = /async function loadData\(\) \{[\s\S]*?carsData\.forEach\(c => carSel\.innerHTML \+= `<option value="\$\{c\._id\}">\$\{c\.brand\} \$\{c\.model\}<\/option>`\);\s*\} catch\(e\) \{ alert\('خطأ في التحميل: ' \+ e\.message\); console\.error\(e\); \}/;

const newLoadData = `async function loadData() {
        try {
            const [c, p, r, emp] = await Promise.all([
                fetch(\`\${API}/customers\`), 
                fetch(\`\${API}/products\`), 
                fetch(\`\${API}/cars\`),
                fetch(\`\${API}/hr/employees?activeOnly=true\`, { headers: authHeaders() })
            ]);
            const customers = await c.json(); products = await p.json(); carsData = await r.json();
            let employees = [];
            if(emp.ok) employees = await emp.json();

            const custSel = document.getElementById('customer');
            customers.forEach(c => custSel.innerHTML += \`<option value="\${c._id}">\${c.name}</option>\`);

            const carSel = document.getElementById('car');
            carsData.forEach(c => carSel.innerHTML += \`<option value="\${c._id}">\${c.brand} \${c.model}</option>\`);

            const salesSel = document.getElementById('salesPerson');
            if(salesSel) {
                employees.forEach(e => {
                    salesSel.innerHTML += \`<option value="\${e._id}">\${e.name || e.code}</option>\`;
                });
            }
        } catch(e) { alert('خطأ في التحميل: ' + e.message); console.error(e); }
    }

    async function refreshCustomers() {
        try {
            const res = await fetch(\`\${API}/customers\`);
            const customers = await res.json();
            const custSel = document.getElementById('customer');
            const prevVal = custSel.value;
            custSel.innerHTML = '<option value="">-- اختر العميل --</option>';
            customers.forEach(c => custSel.innerHTML += \`<option value="\${c._id}">\${c.name}</option>\`);
            custSel.value = prevVal;
            alert('تم استرجاع التحديثات بنجاح!');
        } catch(e) { console.error(e); }
    }

    function addServiceType() {
        const newVal = prompt("أدخل نوع الخدمة أو التصنيف الجديد:");
        if(newVal && newVal.trim()) {
            const sel = document.getElementById('serviceType');
            sel.innerHTML += \`<option value="\${newVal.trim()}" selected>\${newVal.trim()}</option>\`;
        }
    }`;

content = content.replace(loadDataRegex, newLoadData);

// 4. Update createRow
const createRowRegex = /<input type="number" class="len \$\{readonlyClass\}" value="\$\{d\.length\|\|0\}" \$\{readonlyAttr\} oninput="calcArea\(this\)">/g;
content = content.replace(createRowRegex, '<input type="number" class="len" value="${d.length||0}" oninput="calcArea(this)">');

const createRowWidRegex = /<input type="number" class="wid \$\{readonlyClass\}" value="\$\{d\.width\|\|0\}" \$\{readonlyAttr\} oninput="calcArea\(this\)">/g;
content = content.replace(createRowWidRegex, '<input type="number" class="wid" value="${d.width||0}" oninput="calcArea(this)">');

const createRowNameRegex = /<input class="part-name \$\{readonlyClass\}" value="\$\{d\.partName\|\|''\}" \$\{readonlyAttr\}/g;
content = content.replace(createRowNameRegex, '<input class="part-name" value="${d.partName||\'\'}"');

// 5. Update saveInvoice payload
const savePayloadStr = `        const data = {
            invoiceNumber: manualInvNum || undefined,`;
const newSavePayloadStr = `        const data = {
            salesPerson: document.getElementById('salesPerson')?.value || undefined,
            invoiceNumber: manualInvNum || undefined,`;
content = content.replace(savePayloadStr, newSavePayloadStr);

// 6. Update loadForEdit
const loadForEditStr = `        document.getElementById('serviceType').value = inv.serviceType;
        document.getElementById('date').value = inv.date.split('T')[0];`;
const newLoadForEditStr = `        document.getElementById('serviceType').value = inv.serviceType;
        if(document.getElementById('salesPerson') && inv.salesPerson) document.getElementById('salesPerson').value = inv.salesPerson._id || inv.salesPerson;
        document.getElementById('date').value = inv.date.split('T')[0];`;
content = content.replace(loadForEditStr, newLoadForEditStr);

fs.writeFileSync('public/sales_invoice.html', content);
console.log("File updated successfully.");
