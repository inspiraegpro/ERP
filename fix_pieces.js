const fs = require('fs');
let html = fs.readFileSync('public/sales_invoice.html', 'utf8');

const regexOpts = /products\.forEach\(p => opts \+= \`<option value="\$\{p\._id\}" data-price="\$\{p\.pricing\?\.unitSalePrice\|\|0\}" \$\{d\.product===p\._id\?'selected':''\}>\$\{p\.name\}<\/option>\`\);/;
const replaceOpts = `products.forEach(p => opts += \`<option value="\${p._id}" data-price="\${p.pricing?.salePrice || p.pricing?.unitSalePrice || 0}" data-unit="\${p.unit||'ROLL'}" \${d.product===p._id?'selected':''}>\${p.name}</option>\`);`;

const regexHeader = /<th width="10%">مساحة<\/th>/;
const replaceHeader = `<th width="10%">المساحة / الكمية</th>`;

const regexGrid = /<td><input type="number" class="area readonly-input" value="\$\{d\.area\|\|0\}" readonly><\/td>/;
const replaceGrid = `<td><input type="number" class="area readonly-input" value="\${d.area||0}" readonly oninput="updPrice(this.closest('tr').querySelector('.prod'))"></td>`;

const regexUpdPrice = /function updPrice\(el, calculateTotal = true\) \{[\s\S]*?row\.querySelector\('\.row-total'\)\.value = lineTotal;/;

const replaceUpdPrice = `function updPrice(el, calculateTotal = true) {
        if(!el) return;
        const row = el.closest('tr');
        const selectedOption = el.options[el.selectedIndex];
        if(!selectedOption) return;
        
        const priceUnit = parseFloat(selectedOption.getAttribute('data-price')) || 0;
        const unit = selectedOption.getAttribute('data-unit') || 'ROLL';
        
        row.querySelector('.unit-price').value = priceUnit.toFixed(2);
        
        let lineTotal = 0;
        const lenInput = row.querySelector('.len');
        const widInput = row.querySelector('.wid');
        const areaInput = row.querySelector('.area');
        
        if (unit.includes('قطعة') || unit.includes('زجاجة') || unit.toLowerCase() === 'piece' || unit.toLowerCase() === 'bottle') {
            lenInput.value = 0; widInput.value = 0;
            lenInput.readOnly = true; widInput.readOnly = true;
            lenInput.classList.add('readonly-input'); widInput.classList.add('readonly-input');
            
            areaInput.readOnly = false;
            areaInput.classList.remove('readonly-input');
            if (parseFloat(areaInput.value) <= 0) areaInput.value = 1;
            
            lineTotal = (parseFloat(areaInput.value) * priceUnit).toFixed(2);
        } else {
            lenInput.readOnly = false; widInput.readOnly = false;
            lenInput.classList.remove('readonly-input'); widInput.classList.remove('readonly-input');
            
            areaInput.readOnly = true;
            areaInput.classList.add('readonly-input');
            
            const area = parseFloat(areaInput.value) || 0;
            lineTotal = (area * priceUnit).toFixed(2);
        }
        
        row.querySelector('.row-total').value = lineTotal;`;

const regexCalcArea = /function calcArea\(el\) \{[\s\S]*?row\.querySelector\('\.area'\)\.value = area\.toFixed\(4\);[\s\S]*?updPrice\(row\.querySelector\('\.prod'\)\);[\s\S]*?\}/;

const replaceCalcArea = `function calcArea(el) {
        const row = el.closest('tr');
        const prodOpt = row.querySelector('.prod').options[row.querySelector('.prod').selectedIndex];
        const unit = prodOpt ? (prodOpt.getAttribute('data-unit') || 'ROLL') : 'ROLL';
        
        if (unit.includes('قطعة') || unit.includes('زجاجة') || unit.toLowerCase() === 'piece' || unit.toLowerCase() === 'bottle') {
            return; // Don't calculate area for pieces
        }
        
        const len = parseFloat(row.querySelector('.len').value) || 0;
        const wid = parseFloat(row.querySelector('.wid').value) || 0;
        const area = (len * wid) / 10000;
        row.querySelector('.area').value = area.toFixed(4);
        updPrice(row.querySelector('.prod'));
    }`;

// let's do the replaces!
html = html.replace(regexOpts, replaceOpts);
html = html.replace(regexHeader, replaceHeader);
html = html.replace(regexGrid, replaceGrid);
html = html.replace(regexUpdPrice, replaceUpdPrice);
html = html.replace(regexCalcArea, replaceCalcArea);

fs.writeFileSync('public/sales_invoice.html', html);
console.log("Sales Invoice Adjusted for Pieces");
