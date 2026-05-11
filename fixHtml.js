const fs = require('fs');
let text = fs.readFileSync('public/sales_invoice.html', 'utf8');

const regex = /<div class="row">\s*<div class="col">\s*<label>العميل<\/label>\s*<select id="customer"><option value="">-- اختر العميل --<\/option><\/select>\s*<\/div>\s*<div class="col">\s*<label>السيارة<\/label>\s*<select id="car" onchange="populateCarParts\(\)"><option value="">-- اختر لتنزيل القطع --<\/option><\/select>\s*<\/div>\s*<div class="col">\s*<label>نوع الخدمة<\/label>\s*<select id="serviceType"><option value="تغليف كامل">تغليف كامل<\/option><option value="حماية">حماية \(PPF\)<\/option><option value="تلميع">تلميع<\/option><option value="عازل">عازل حراري<\/option><\/select>\s*<\/div>\s*<\/div>/g;

const newGridRaw = `<div class="row">
        <div class="col" style="flex:1.2;">
            <label style="display:flex; justify-content:space-between">
                العميل
                <a href="customers.html" target="_blank" style="font-size:11px; color:#3b82f6; text-decoration:none;">+ عميل جديد</a>
            </label>
            <select id="customer"><option value="">-- اختر العميل --</option></select>
            <button class="btn btn-list no-print" style="padding:4px 8px; font-size:10px; margin-top:5px; width:100%" onclick="refreshCustomers()">🔄 تحديث العملاء</button>
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

text = text.replace(regex, newGridRaw);
fs.writeFileSync('public/sales_invoice.html', text);
console.log('Update HTML fixed!');
