
    const API = '/api';
    const token = localStorage.getItem('token') || '';
    let products = [], carsData = [];

    function authHeaders(includeJson = false) {
        const headers = {};
        if (includeJson) headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    window.onload = async () => {
        document.getElementById('date').valueAsDate = new Date();
        await loadData();
        
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if(id) loadForEdit(id);
    };

    async function loadData() {
        try {
            const [c, p, r, emp] = await Promise.all([
                fetch(`${API}/customers`), 
                fetch(`${API}/products`), 
                fetch(`${API}/cars`),
                fetch(`${API}/hr/employees?activeOnly=true`, { headers: authHeaders() })
            ]);
            const customers = await c.json(); products = await p.json(); carsData = await r.json();
            let employees = [];
            if(emp.ok) employees = await emp.json();

            const custSel = document.getElementById('customer');
            customers.forEach(c => custSel.innerHTML += `<option value="${c._id}">${c.name}</option>`);

            const carSel = document.getElementById('car');
            carsData.forEach(c => carSel.innerHTML += `<option value="${c._id}">${c.brand} ${c.model}</option>`);

            const salesSel = document.getElementById('salesPerson');
            if(salesSel) {
                employees.forEach(e => {
                    salesSel.innerHTML += `<option value="${e._id}">${e.name || e.code}</option>`;
                });
            }
        } catch(e) { alert('خطأ في التحميل: ' + e.message); console.error(e); }
    }

    async function refreshCustomers() {
        try {
            const res = await fetch(`${API}/customers`);
            const customers = await res.json();
            const custSel = document.getElementById('customer');
            const prevVal = custSel.value;
            custSel.innerHTML = '<option value="">-- اختر العميل --</option>';
            customers.forEach(c => custSel.innerHTML += `<option value="${c._id}">${c.name}</option>`);
            custSel.value = prevVal;
            alert('تم استرجاع التحديثات بنجاح!');
        } catch(e) { console.error(e); }
    }

    function addServiceType() {
        const newVal = prompt("أدخل نوع الخدمة أو التصنيف الجديد:");
        if(newVal && newVal.trim()) {
            const sel = document.getElementById('serviceType');
            sel.innerHTML += `<option value="${newVal.trim()}" selected>${newVal.trim()}</option>`;
        }
    }

    function populateCarParts() {
        const carId = document.getElementById('car').value;
        const tbody = document.querySelector('tbody');
        if(!carId) return; 
        
        tbody.innerHTML = '';
        const car = carsData.find(c => c._id === carId);
        if (car && car.parts) {
            car.parts.forEach(part => createRow({ partName: part.name, length: part.lengthCM, width: part.widthCM, area: part.areaCM2 }));
        } else { createRow(); }
        calcTotal();
    }

    function createRow(d = {}) {
        const tbody = document.querySelector('tbody');
        let opts = '<option value="">اختر الخامة</option>';
        products.forEach(p => opts += `<option value="${p._id}" data-price="${p.pricing?.unitSalePrice||0}" ${d.product===p._id?'selected':''}>${p.name}</option>`);

        const isManual = !d.partName || d.isManual; // Flag for manual entry
        const readonlyAttr = isManual ? '' : 'readonly';
        const readonlyClass = isManual ? '' : 'readonly-input';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input class="part-name" value="${d.partName||''}" placeholder="اسم القطعة"></td>
            <td><select class="prod" onchange="updPrice(this)">${opts}</select></td>
            <!-- Removed Roll Code Column -->
            <td><input type="number" class="len" value="${d.length||0}" oninput="calcArea(this)"></td>
            <td><input type="number" class="wid" value="${d.width||0}" oninput="calcArea(this)"></td>
            <td><input type="number" class="area readonly-input" value="${d.area||0}" readonly></td>
            <td><input type="number" class="unit-price" value="${d.priceUnit||0}" readonly style="color:#666"></td>
            <td><input type="number" class="row-total" value="${d.lineTotal||0}" oninput="calcTotal()" style="color:green;font-weight:bold"></td>
            <td class="no-print"><button class="btn-del" onclick="this.closest('tr').remove();calcTotal()">X</button></td>
        `;
        tbody.appendChild(tr);
        if(d.product) {
             const prodSelect = tr.querySelector('.prod');
             updPrice(prodSelect, false); // Don't reset total if loading
        }
    }

    function calcArea(el) {
        const row = el.closest('tr');
        const len = parseFloat(row.querySelector('.len').value) || 0;
        const wid = parseFloat(row.querySelector('.wid').value) || 0;
        const area = (len * wid) / 10000;
        row.querySelector('.area').value = area.toFixed(4);
        updPrice(row.querySelector('.prod'));
    }

    function addEmptyRow() { createRow({ isManual: true }); }

    // Removed loadRolls function as it is no longer needed


    function updPrice(el, calculateTotal = true) {
        if(!el) return;
        const row = el.closest('tr');
        const selectedOption = el.options[el.selectedIndex];
        const priceUnit = parseFloat(selectedOption.getAttribute('data-price')) || 0;
        row.querySelector('.unit-price').value = priceUnit.toFixed(2);
        
        const area = parseFloat(row.querySelector('.area').value) || 0;
        const lineTotal = (area * priceUnit).toFixed(2);
        row.querySelector('.row-total').value = lineTotal;
        
        if (calculateTotal) {
            calcTotal();
        }
    }

    function calcTotal() {
        let sub = 0;
        document.querySelectorAll('.row-total').forEach(i => sub += parseFloat(i.value)||0);
        document.getElementById('subtotal').innerText = sub.toFixed(2);

        const extra = parseFloat(document.getElementById('extraCost').value)||0;
        const disc = parseFloat(document.getElementById('discount').value)||0;
        
        let taxable = (sub + extra) - disc;
        let vat = document.getElementById('hasVat').checked ? taxable * 0.14 : 0;
        let wht = document.getElementById('hasWht').checked ? sub * 0.01 : 0;

        document.getElementById('vatVal').innerText = vat.toFixed(2);
        document.getElementById('whtVal').innerText = wht.toFixed(2);
        document.getElementById('finalTotal').innerText = (taxable + vat - wht).toFixed(2);
    }

    async function saveInvoice() {
        const items = [];
        document.querySelectorAll('tbody tr').forEach(tr => {
            if(tr.querySelector('.prod').value) {
                items.push({
                    product: tr.querySelector('.prod').value,
                    partName: tr.querySelector('.part-name').value,
                    lengthCM: tr.querySelector('.len').value,
                    widthCM: tr.querySelector('.wid').value,
                    area: tr.querySelector('.area').value,
                    price: tr.querySelector('.row-total').value
                });
            }
        });

        if(items.length === 0) { alert('أضف صنف واحد على الأقل'); return; }

        const id = document.getElementById('editId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API}/sales/${id}` : `${API}/sales`;

        const manualInvNum = document.getElementById('invNum').value.trim();
        
        const data = {
            salesPerson: document.getElementById('salesPerson')?.value || undefined,
            invoiceNumber: manualInvNum || undefined,
            date: document.getElementById('date').value,
            customer: document.getElementById('customer').value,
            carModel: document.getElementById('car').value,
            serviceType: document.getElementById('serviceType').value,
            items: items,
            subtotal: parseFloat(document.getElementById('subtotal').innerText),
            totalExtraCosts: parseFloat(document.getElementById('extraCost').value)||0,
            totalDiscount: parseFloat(document.getElementById('discount').value)||0,
            totalTax: parseFloat(document.getElementById('vatVal').innerText)||0,
            whtAmount: parseFloat(document.getElementById('whtVal').innerText)||0,
            finalTotal: parseFloat(document.getElementById('finalTotal').innerText)
        };

        try {
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
        data.push(["رقم الفاتورة", invNum]); // هنا
        data.push(["العميل", customer]);
        data.push(["السيارة", car]);
        data.push(["التاريخ", date]);
        data.push([]); 

        data.push(["القطعة", "الخامة", "طول", "عرض", "مساحة", "السعر", "الإجمالي"]);

        document.querySelectorAll('tbody tr').forEach(tr => {
            const prodSelect = tr.querySelector('.prod');
            const prodName = prodSelect.options[prodSelect.selectedIndex]?.text || '';
            data.push([
                tr.querySelector('.part-name').value,
                prodName,
                tr.querySelector('.len').value,
                tr.querySelector('.wid').value,
                tr.querySelector('.area').value,
                tr.querySelector('.unit-price').value,
                tr.querySelector('.row-total').value
            ]);
        });

        data.push([]);
        data.push(["الإجمالي", document.getElementById('subtotal').innerText]);
        data.push(["خدمات إضافية", document.getElementById('extraCost').value]);
        data.push(["الصافي", document.getElementById('finalTotal').innerText]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice");
        XLSX.writeFile(wb, `Invoice_${customer}_${date}.xlsx`);
    }

    function importFromExcel(input) {
        const file = input.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

            // 1. قراءة الترويسة
            // نتوقع أن رقم الفاتورة في الصف 2 العمود 2 (Index 1, 1) بعد التعديل
            if(jsonData[1] && jsonData[1][1]) document.getElementById('invNum').value = jsonData[1][1];
            if(jsonData[2] && jsonData[2][1]) selectOptionByText('customer', jsonData[2][1]);
            if(jsonData[3] && jsonData[3][1]) selectOptionByText('car', jsonData[3][1]);
            if(jsonData[4] && jsonData[4][1]) document.getElementById('date').value = jsonData[4][1];

            // 2. قراءة الجدول
            document.querySelector('tbody').innerHTML = '';
            
            let startRow = -1;
            for(let i=0; i<jsonData.length; i++) {
                if(jsonData[i] && jsonData[i][0] == 'القطعة') {
                    startRow = i + 1;
                    break;
                }
            }

            if(startRow !== -1) {
                for(let i=startRow; i<jsonData.length; i++) {
                    const row = jsonData[i];
                    if(!row || row.length === 0 || row[0] === 'الإجمالي') break; 

                    const partName = row[0];
                    const matName = row[1];
                    const len = row[2] || 0;
                    const wid = row[3] || 0;
                    const area = row[4] || (len*wid);
                    const total = row[6] || 0;

                    const productObj = products.find(p => p.name === matName);
                    const prodId = productObj ? productObj._id : '';
                    const priceUnit = productObj ? (productObj.pricing?.unitSalePrice || 0) : 0;

                    createRow({ 
                        partName: partName, 
                        product: prodId,
                        length: len, 
                        width: wid, 
                        area: area,
                        priceUnit: priceUnit, 
                        lineTotal: total      
                    });
                }
            }
            
            // 3. قراءة الإجماليات
            for(let i=jsonData.length-1; i>0; i--) {
                const row = jsonData[i];
                if(row && row[0] == 'خدمات إضافية') {
                    document.getElementById('extraCost').value = row[1] || 0;
                    break;
                }
            }

            calcTotal();
            alert('تم استيراد البيانات بنجاح ✅');
        };
        reader.readAsArrayBuffer(file);
    }

    function selectOptionByText(id, text) {
        const select = document.getElementById(id);
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].text === text) {
                select.selectedIndex = i;
                if(id === 'car') populateCarParts();
                break;
            }
        }
    }

    async function loadForEdit(id) {
        const res = await fetch(`${API}/sales/${id}`);
        const inv = await res.json();
        
        document.getElementById('editId').value = inv._id;
        document.getElementById('invNum').value = inv.invoiceNumber; 
        document.getElementById('customer').value = inv.customer?._id || inv.customer; 
        document.getElementById('car').value = inv.carModel?._id || inv.carModel;
        document.getElementById('serviceType').value = inv.serviceType;
        document.getElementById('date').value = inv.date.split('T')[0];
        
        document.getElementById('extraCost').value = inv.totalExtraCosts || 0;
        document.getElementById('discount').value = inv.totalDiscount || 0;
        
        if(inv.totalTax > 0) document.getElementById('hasVat').checked = true;
        if(inv.whtAmount > 0) document.getElementById('hasWht').checked = true;

        const tbody = document.querySelector('tbody');
        tbody.innerHTML = '';
        inv.items.forEach(item => {
            createRow({
                partName: item.partName,
                product: item.product?._id || item.product,
                rollCode: item.rollCode, // Pass saved roll code
                length: item.lengthCM,
                width: item.widthCM,
                area: item.area,
                priceUnit: 0, 
                lineTotal: item.price
            });
        });
        calcTotal();
    }
