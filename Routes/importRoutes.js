const express = require('express');
const router = express.Router();
const ImportShipment = require('../models/ImportShipment');
const Account = require('../models/Account');
const Supplier = require('../models/Supplier');
const JournalEntry = require('../models/JournalEntry');
const { createGlEntry } = require('../services/glService');
const FinancialSettings = require('../models/FinancialSettings');

// 1. عرض الكل
router.get('/', async (req, res) => {
    try {
        const list = await ImportShipment.find();
        // جلب أسماء الموردين يدوياً
        for (let item of list) {
            if (item.supplier) {
                try {
                    const sup = await Supplier.findOne({ _id: item.supplier });
                    item.supplierName = sup ? sup.name : '-';
                } catch (e) { item.supplierName = '-'; }
            }
        }
        res.json(list);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// 2. عرض شحنة واحدة
router.get('/:id', async (req, res) => {
    try {
        const item = await ImportShipment.findOne({ _id: req.params.id });
        if (!item) return res.status(404).json({ message: "غير موجود" });
        res.json(item);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// 3. حفظ/تحديث الشحنة
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // تنظيف البيانات
        if (data.costLines) data.costLines.forEach(l => { if (l.vendor === "") l.vendor = null; });
        if (data.intermediarySupplier === "") data.intermediarySupplier = null;
        if (data.supplier === "") data.supplier = null;

        let savedItem;
        if (data._id && data._id !== "null") {
            const id = data._id;
            delete data._id;
            savedItem = await ImportShipment.updateOne({ _id: id }, data);
        } else {
            delete data._id;
            savedItem = await ImportShipment.create(data);
        }
        res.json(savedItem);
    } catch (e) {
        console.error("Import Save Error:", e);
        res.status(400).json({ message: "فشل الحفظ: " + e.message });
    }
});

// 4. الترحيل المالي
router.post('/:id/post-financial', async (req, res) => {
    try {
        const shipment = await ImportShipment.findOne({ _id: req.params.id });
        if (!shipment) throw new Error("الشحنة غير موجودة");
        if (shipment.status === 'FinancialPosted' || shipment.status === 'Received') throw new Error("تم الترحيل مسبقاً");

        // أ) الحسابات
        const settings = await FinancialSettings.findOne() || {};
        const accTransitId = settings.defaultTransitAccountId || (await getAccount('5101', 'مشتريات وسيط', 'Asset'))._id;
        const accTransit = await Account.findOne({ _id: accTransitId }) || await getAccount('5101', 'مشتريات وسيط', 'Asset');
        
        const accVatId = settings.defaultVatInputAccountId || (await getAccount('110403', 'ضريبة قيمة مضافة', 'Asset'))._id;
        const accVat = await Account.findOne({ _id: accVatId }) || await getAccount('110403', 'ضريبة قيمة مضافة', 'Asset');

        const allSuppliers = await Supplier.find();
        const supplierId = shipment.supplier || (allSuppliers.length > 0 ? allSuppliers[0]._id : null);
        const intSupplierId = shipment.intermediarySupplier || supplierId;

        // ب) حساب التكاليف
        const rate = parseFloat(shipment.exchangeRate) || 1;
        const commRate = parseFloat(shipment.bankCommissionRate) || 0.008;

        let totalGoods = 0;
        (shipment.items || []).forEach(i => totalGoods += (parseFloat(i.quantity) * parseFloat(i.unitForeignPrice) * rate));

        const bankFees = totalGoods * commRate;
        let totalExp = 0;
        (shipment.costLines || []).forEach(c => { if (!c.isVat) totalExp += (parseFloat(c.amount) || 0); });

        const totalCost = totalGoods + bankFees + totalExp;

        // ج) توزيع التكلفة
        (shipment.items || []).forEach(item => {
            const itemVal = parseFloat(item.quantity) * parseFloat(item.unitForeignPrice) * rate;
            const ratio = totalGoods > 0 ? (itemVal / totalGoods) : (1 / (shipment.items.length || 1));
            const itemTotalCost = itemVal + (bankFees * ratio) + (totalExp * ratio);

            const prod = item.product || {};
            let area = 0;
            
            const unit = String(prod.unit || '').toLowerCase();
            const isPiece = unit.includes('قطعة') || unit.includes('عدد') || unit.includes('piece') || prod.isPiece;
            
            if (isPiece) {
                area = 1;
            } else if (Number(prod.area) > 0) {
                area = Number(prod.area);
            } else {
                const length = Number(prod.dimensions?.length || prod.length || 0);
                const width = Number(prod.dimensions?.width || prod.width || 0);
                if (length > 100 || width > 100) {
                    area = (length * width) / 10000;
                } else {
                    area = length * width;
                }
            }

            const totalArea = parseFloat(item.quantity) * area;

            if (totalArea > 0) item.unitLandedCost = itemTotalCost / totalArea;
            else item.unitLandedCost = itemTotalCost / (parseFloat(item.quantity) || 1);
        });

        // د) قيود اليومية
        let details = [];
        details.push({ accountId: accTransit._id, accountName: accTransit.name, debit: totalGoods + bankFees, credit: 0, description: `استحقاق بضاعة وعمولة - ${shipment.shipmentRef}` });

        (shipment.costLines || []).forEach(line => {
            const targetAcc = line.isVat ? accVat : accTransit;
            details.push({ accountId: targetAcc._id, accountName: targetAcc.name, debit: parseFloat(line.amount) || 0, credit: 0, description: line.description });
        });

        const totalDebit = details.reduce((sum, d) => sum + d.debit, 0);

        const supRecord = await Supplier.findOne({ _id: intSupplierId });
        const supAcc = supRecord?.accountId || settings.defaultSupplierAccountId || (await getAccount('2101', 'موردين', 'Liability'))._id;
        const supAccInfo = await Account.findOne({ _id: supAcc });

        details.push({ accountId: supAcc, accountName: supAccInfo?.name || 'موردين', debit: 0, credit: totalDebit, description: `مستحقات شحنة ${shipment.shipmentRef}` });

        await createGlEntry({
            description: `قيد استحقاق شحنة ${shipment.shipmentRef}`,
            details: details,
            date: shipment.date
        });

        // هـ) الحفظ
        shipment.totalLandedCost = totalCost;
        shipment.status = 'FinancialPosted';
        await ImportShipment.updateOne({ _id: req.params.id }, shipment);

        res.json({ success: true, message: "تم الترحيل المالي وحساب التكلفة ✅" });

    } catch (e) { res.status(500).json({ message: e.message }); }
});

// 5. إلغاء الترحيل المالي
router.post('/:id/cancel-financial', async (req, res) => {
    try {
        const shipment = await ImportShipment.findOne({ _id: req.params.id });
        if (!shipment) throw new Error("الشحنة غير موجودة");
        if (shipment.status === 'Received') throw new Error("لا يمكن إلغاء الترحيل لشحنة تم استلامها مخزنياً");
        if (shipment.status !== 'FinancialPosted') throw new Error("الشحنة ليست مرحلة مالياً");

        // البحث عن قيد اليومية وحذفه
        const glDescription = `قيد استحقاق شحنة ${shipment.shipmentRef}`;
        const journalEntries = await JournalEntry.find({ description: glDescription });
        
        for (const entry of journalEntries) {
            await JournalEntry.db.deleteOne('journal_entries', { _id: entry._id });
        }

        // تصفير تكلفة القطع وإرجاع الحالة
        (shipment.items || []).forEach(item => {
            item.unitLandedCost = 0;
        });

        shipment.totalLandedCost = 0;
        shipment.status = 'Draft';
        await ImportShipment.updateOne({ _id: req.params.id }, shipment);

        res.json({ success: true, message: "تم إلغاء الترحيل المالي بنجاح وإرجاع الشحنة كمسودة ✅" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

async function getAccount(code, name, type) {
    let a = await Account.findOne({ code });
    if (!a) a = await Account.create({ code, name, type, nature: type === 'Liability' ? 'Credit' : 'Debit', isTransactional: true });
    return a;
}

module.exports = router;
