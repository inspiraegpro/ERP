const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

router.get('/', async (req, res) => {
    try {
        const customers = await db.find('customers');
        customers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.json(customers);
    } catch (error) {
        console.error('Error getting customers:', error);
        res.status(500).json({ error: 'فشل جلب العملاء' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const customer = await db.findOne('customers', { _id: req.params.id });
        if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }
        res.json(customer);
    } catch (error) {
        console.error('Error getting customer:', error);
        res.status(500).json({ error: 'فشل جلب العميل' });
    }
});

router.post('/', async (req, res) => {
    try {
        const customerData = {
            name: req.body.name,
            phone: req.body.phone || '',
            email: req.body.email || '',
            address: req.body.address || '',
            accountId: req.body.accountId || null,
            balance: Number(req.body.balance || 0)
        };

        const newCustomer = await db.create('customers', customerData);
        res.status(201).json(newCustomer);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: `فشل إنشاء العميل: ${error.message}` });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            phone: req.body.phone || '',
            email: req.body.email || '',
            address: req.body.address || '',
            accountId: req.body.accountId || null,
            balance: Number(req.body.balance || 0)
        };

        const updatedCustomer = await db.updateOne('customers', { _id: req.params.id }, updateData);
        if (!updatedCustomer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }

        res.json(updatedCustomer);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'فشل تحديث العميل' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await db.deleteOne('customers', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }

        res.json({ message: 'تم حذف العميل بنجاح' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'فشل حذف العميل' });
    }
});

module.exports = router;
