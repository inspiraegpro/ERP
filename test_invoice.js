const axios = require('axios');

const API = 'http://localhost:13620/api';

async function testSaveInvoice() {
    const data = {
        invoiceNumber: 'TEST-001',
        date: new Date().toISOString().split('T')[0],
        customer: 'customer_1771294912231', // استخدم ID عميل موجود
        customerName: 'شركة التطوير التجارية',
        carModel: 'mljlbsx4o05w11j5uge', // استخدم ID سيارة موجود
        serviceType: 'تغليف كامل',
        items: [
            {
                product: 'mljlbsw3wxrhr6jy24o', // استخدم ID منتج موجود
                partName: 'قطعة تجريبية',
                lengthCM: 100,
                widthCM: 50,
                area: 0.5,
                price: 100
            }
        ],
        subtotal: 100,
        totalExtraCosts: 0,
        totalDiscount: 0,
        totalTax: 14, // 14% من 100 = 14
        whtAmount: 1, // 1% من 100 = 1
        finalTotal: 100 // referenceTotal
    };

    try {
        const res = await axios.post(`${API}/sales`, data);
        console.log('Response:', res.data);
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

testSaveInvoice();