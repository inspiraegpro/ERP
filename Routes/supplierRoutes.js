const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

router.get('/', async (req, res) => {
    try {
        const suppliers = await db.find('suppliers');
        suppliers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.json(suppliers);
    } catch (error) {
        console.error('Error getting suppliers:', error);
        res.status(500).json({ error: 'فشل جلب الموردين' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const supplier = await db.findOne('suppliers', { _id: req.params.id });
        if (!supplier) {
            return res.status(404).json({ error: 'المورد غير موجود' });
        }
        res.json(supplier);
    } catch (error) {
        console.error('Error getting supplier:', error);
        res.status(500).json({ error: 'فشل جلب المورد' });
    }
});

router.post('/', async (req, res) => {
    try {
        const supplierData = {
            code: req.body.code || '',
            name: req.body.name,
            phone: req.body.phone || '',
            email: req.body.email || '',
            address: req.body.address || '',
            companyName: req.body.companyName || '',
            taxId: req.body.taxId || '',
            accountId: req.body.accountId || null,
            balance: Number(req.body.balance || 0)
        };

        const newSupplier = await db.create('suppliers', supplierData);
        res.status(201).json(newSupplier);
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'فشل إنشاء المورد' });
    }
});

router.put('/:id', async (req, res) => {  
    try {
        const updateData = {
            code: req.body.code || '',
            name: req.body.name,
            phone: req.body.phone || '',
            email: req.body.email || '',
            address: req.body.address || '',
            companyName: req.body.companyName || '',
            taxId: req.body.taxId || '',
            accountId: req.body.accountId || null,
            balance: Number(req.body.balance || 0)
        };

        const updatedSupplier = await db.updateOne('suppliers', { _id: req.params.id }, updateData);
        if (!updatedSupplier) {
            return res.status(404).json({ error: 'المورد غير موجود' });
        }

        res.json(updatedSupplier);
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'فشل تحديث المورد' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await db.deleteOne('suppliers', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'المورد غير موجود' });
        }

        res.json({ message: 'تم حذف المورد بنجاح' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'فشل حذف المورد' });
    }
});

module.exports = router;
