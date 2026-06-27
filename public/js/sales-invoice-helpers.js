// public/js/sales-invoice-helpers.js

const WINDOW_FILM_MATRIX = {
    parts: [
        { part: '2 Doors' },
        { part: '4 Doors' },
        { part: 'Front Windshield' },
        { part: 'Rear Windshield' },
        { part: 'Sunroof' },
        { part: 'Full Glass Roof' },
        { part: 'Half Package' },
        { part: 'Full Package' },
        { part: 'Full Package + Sunroof' },
        { part: 'Full Package + Full Roof' }
    ],
    grades: [1, 2, 3, 4, 5, 6]
};

async function getWindowFilmPriceHelper(part, vehicleCategory, grade = null) {
    try {
        let url = `/api/pricing/calculate?vehicleCategory=${encodeURIComponent(vehicleCategory)}&carPart=${encodeURIComponent(part)}&area=1`;
        if (grade !== null) url += `&grade=${grade}`;
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            return data.totalPrice || data.basePrice || 0;
        }
    } catch (e) {
        console.error('Error fetching matrix price:', e);
    }
    return 0;
}

// PPF Packages Modal & Engine
function calculatePPFPackages(rowId, materialType, selectedCarParts) {
    const existing = document.getElementById('ppfModeModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'ppfModeModal';
    modal.setAttribute('data-material-type', materialType);
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9999;';
    
    modal.innerHTML = `
        <div style="width:min(720px,92vw);max-height:85vh;overflow:auto;background:#fff;border-radius:16px;padding:16px;">
            <h3 style="margin:0 0 10px;">باقات ${materialType} <span style="font-size:14px;color:#64748b">(السعر يُحسب من السيرفر)</span></h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button type="button" class="btn btn-list ppf-choice" data-mode="full_incl" onclick="window.InvoiceHelpers._selectPackage(this, 'full_incl')">
                    Full Wrap + Roof <br><small>كل الأجزاء + السقف</small>
                </button>
                <button type="button" class="btn btn-list ppf-choice" data-mode="full_excl" onclick="window.InvoiceHelpers._selectPackage(this, 'full_excl')">
                    Full Wrap - Roof <br><small>كل الأجزاء بدون السقف</small>
                </button>
                <button type="button" class="btn btn-list ppf-choice" data-mode="custom" onclick="window.InvoiceHelpers._selectPackage(this, 'custom')">
                    أجزاء محددة <br><small>اختر بنفسك</small>
                </button>
            </div>
            <input id="ppfPartSearch" placeholder="ابحث داخل الأجزاء..." style="width:100%;border:1px solid #d0d7e2;border-radius:10px;padding:8px 10px;margin-bottom:10px;" onkeyup="window.InvoiceHelpers._searchPPFParts(this.value)">
            <div id="ppfCustomParts" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:10px;max-height:300px;overflow-y:auto;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;border-top:1px solid #e5e7eb;padding-top:12px;">
                <div id="packageSummary" style="color:#64748b;font-size:14px;">
                    المساحة: 0 م² | السعر: 0 ج.م
                </div>
                <div style="display:flex;gap:8px;">
                    <button type="button" class="btn btn-list" onclick="document.getElementById('ppfModeModal').remove()">إلغاء</button>
                    <button type="button" class="btn btn-save" onclick="applyPackageSelection('${rowId}')">تأكيد</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const parts = selectedCarParts && selectedCarParts.length > 0 ? selectedCarParts : [];
    const host = modal.querySelector('#ppfCustomParts');
    if (parts.length === 0) {
        host.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">اختر سيارة أولاً لتحميل الأجزاء</div>';
        return;
    }

    let partsHtml = '';
    parts.forEach((p, i) => {
        partsHtml += `
            <label class="ppf-part-label" data-is-roof="${p.isRoof ? 'true' : 'false'}" style="display:flex;align-items:center;gap:8px;background:#f8fafc;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.2s;">
                <input type="checkbox" class="ppf-part-cb ppf-custom-check" value="${i}" data-part="${p.name}" data-area="${p.areaM2}" onchange="window.InvoiceHelpers._updatePackageSummary()">
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:14px;color:#1e293b;margin-bottom:2px;">${p.name}</div>
                    <div style="font-size:11px;color:#64748b;">${p.length}×${p.width} سم | ${p.areaM2} م² ${p.isRoof ? '<span style="color:#f59e0b;font-weight:bold;">(سقف)</span>' : ''}</div>
                </div>
            </label>
        `;
    });
    host.innerHTML = partsHtml;
}

function _selectPackage(btn, mode) {
    document.querySelectorAll('.ppf-choice').forEach(b => {
        b.style.background = '#f8fafc';
        b.style.color = '#334155';
        b.style.borderColor = '#cbd5e1';
    });
    btn.style.background = '#eff6ff';
    btn.style.color = '#2563eb';
    btn.style.borderColor = '#bfdbfe';

    const labels = document.querySelectorAll('.ppf-part-label');
    labels.forEach(lbl => {
        const cb = lbl.querySelector('.ppf-part-cb');
        const isRoof = lbl.getAttribute('data-is-roof') === 'true';
        if (mode === 'full_incl') {
            cb.checked = true;
        } else if (mode === 'full_excl') {
            cb.checked = !isRoof;
        } else {
            cb.checked = false;
        }
    });
    window.InvoiceHelpers._updatePackageSummary();
    const modal = document.getElementById('ppfModeModal');
    if (modal) modal.setAttribute('data-mode', mode);
}

function _searchPPFParts(val) {
    const term = val.toLowerCase();
    document.querySelectorAll('.ppf-part-label').forEach(lbl => {
        const text = lbl.textContent.toLowerCase();
        lbl.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

function _updatePackageSummary() {
    let totalArea = 0;
    const selectedIndices = Array.from(document.querySelectorAll('.ppf-part-cb:checked')).map(cb => cb.value);
    
    if(window.allSavedParts) {
        selectedIndices.forEach(idx => {
            const p = window.allSavedParts[idx];
            if (p) totalArea += Number(p.areaM2 || 0);
        });
    }

    const summary = document.getElementById('packageSummary');
    if (summary) {
        summary.innerHTML = `المساحة الإجمالية: <strong>${totalArea.toFixed(4)}</strong> م² | السعر النهائي سيُحسب تلقائياً`;
    }
}

function exportInvoiceToExcel(documentScope) {
    const doc = documentScope || document;
    const invNum = doc.getElementById('invNum').value;
    const customer = doc.getElementById('customer').options[doc.getElementById('customer').selectedIndex]?.text || '';
    const car = doc.getElementById('car').options[doc.getElementById('car').selectedIndex]?.text || '';
    const date = doc.getElementById('date').value;

    let data = [];
    data.push(["فاتورة مبيعات"]);
    data.push(["رقم الفاتورة", invNum]);
    data.push(["العميل", customer]);
    data.push(["السيارة", car]);
    data.push(["التاريخ", date]);
    data.push([]); 

    data.push(["القطعة", "الخامة", "طول", "عرض", "مساحة", "السعر", "الإجمالي"]);

    doc.querySelectorAll('tbody tr').forEach(tr => {
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
    data.push(["الإجمالي", doc.getElementById('subtotal').innerText]);
    data.push(["خدمات إضافية", doc.getElementById('extraCost').value]);
    data.push(["الصافي", doc.getElementById('finalTotal').innerText]);

    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice");
        XLSX.writeFile(wb, `Invoice_${customer}_${date}.xlsx`);
    } else {
        alert("XLSX library not found!");
    }
}

function importInvoiceFromExcel(input, documentScope, productsScope, createRowFunc, syncInvoiceFunc) {
    const doc = documentScope || document;
    const products = productsScope || window.products || [];
    const file = input.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') return alert("XLSX library not found!");
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

        if(jsonData[1] && jsonData[1][1]) doc.getElementById('invNum').value = jsonData[1][1];
        if(jsonData[2] && jsonData[2][1] && typeof window.selectOptionByText === 'function') window.selectOptionByText('customer', jsonData[2][1]);
        if(jsonData[3] && jsonData[3][1] && typeof window.selectOptionByText === 'function') window.selectOptionByText('car', jsonData[3][1]);
        if(jsonData[4] && jsonData[4][1]) doc.getElementById('date').value = jsonData[4][1];

        doc.querySelector('tbody').innerHTML = '';
        
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

                createRowFunc({ 
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
        
        for(let i=jsonData.length-1; i>0; i--) {
            const row = jsonData[i];
            if(row && row[0] == 'خدمات إضافية') {
                doc.getElementById('extraCost').value = row[1] || 0;
                break;
            }
        }

        syncInvoiceFunc();
        alert('تم استيراد البيانات بنجاح ✅');
    };
    reader.readAsArrayBuffer(file);
}

window.InvoiceHelpers = {
    WINDOW_FILM_MATRIX,
    getWindowFilmPriceHelper,
    calculatePPFPackages,
    exportInvoiceToExcel,
    importInvoiceFromExcel,
    _selectPackage,
    _searchPPFParts,
    _updatePackageSummary
};
