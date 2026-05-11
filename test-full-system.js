const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 13620,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function fullSystemTest() {
    console.log('🔍 اختبار شامل للنظام...\n');
    
    const results = {
        accounts: { status: null, count: 0, details: '' },
        customers: { status: null, count: 0, details: '' },
        suppliers: { status: null, count: 0, details: '' },
        products: { status: null, count: 0, details: '' },
        stock: { status: null, count: 0, details: '' },
        sales: { status: null, count: 0, details: '' },
        purchases: { status: null, count: 0, details: '' },
        treasury: { status: null, count: 0, details: '' },
        serviceJobs: { status: null, count: 0, details: '' },
        reports: { status: null, details: '' }
    };

    // Test 1: Accounts
    console.log('1️⃣ اختبار الحسابات...');
    const accountsResult = await makeRequest('/api/accounts');
    results.accounts.status = accountsResult.status;
    results.accounts.count = Array.isArray(accountsResult.data) ? accountsResult.data.length : 0;
    results.accounts.details = accountsResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.accounts.details} - ${results.accounts.count} حساب`);

    // Test 2: Customers
    console.log('2️⃣ اختبار العملاء...');
    const customersResult = await makeRequest('/api/customers');
    results.customers.status = customersResult.status;
    results.customers.count = Array.isArray(customersResult.data) ? customersResult.data.length : 0;
    results.customers.details = customersResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.customers.details} - ${results.customers.count} عميل`);

    // Test 3: Suppliers
    console.log('3️⃣ اختبار الموردين...');
    const suppliersResult = await makeRequest('/api/suppliers');
    results.suppliers.status = suppliersResult.status;
    results.suppliers.count = Array.isArray(suppliersResult.data) ? suppliersResult.data.length : 0;
    results.suppliers.details = suppliersResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.suppliers.details} - ${results.suppliers.count} مورد`);

    // Test 4: Products
    console.log('4️⃣ اختبار المنتجات...');
    const productsResult = await makeRequest('/api/products');
    results.products.status = productsResult.status;
    results.products.count = Array.isArray(productsResult.data) ? productsResult.data.length : 0;
    results.products.details = productsResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.products.details} - ${results.products.count} منتج`);

    // Test 5: Stock
    console.log('5️⃣ اختبار المخزون...');
    const stockResult = await makeRequest('/api/stock');
    results.stock.status = stockResult.status;
    results.stock.count = Array.isArray(stockResult.data) ? stockResult.data.length : 0;
    results.stock.details = stockResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.stock.details} - ${results.stock.count} حركة`);

    // Test 6: Sales
    console.log('6️⃣ اختبار المبيعات...');
    const salesResult = await makeRequest('/api/sales');
    results.sales.status = salesResult.status;
    results.sales.count = Array.isArray(salesResult.data) ? salesResult.data.length : 0;
    results.sales.details = salesResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.sales.details} - ${results.sales.count} فاتورة`);

    // Test 7: Purchases
    console.log('7️⃣ اختبار المشتريات...');
    const purchasesResult = await makeRequest('/api/purchases');
    results.purchases.status = purchasesResult.status;
    results.purchases.count = Array.isArray(purchasesResult.data) ? purchasesResult.data.length : 0;
    results.purchases.details = purchasesResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.purchases.details} - ${results.purchases.count} فاتورة`);

    // Test 8: Treasury
    console.log('8️⃣ اختبار الخزينة...');
    const treasuryResult = await makeRequest('/api/treasury');
    results.treasury.status = treasuryResult.status;
    results.treasury.count = Array.isArray(treasuryResult.data) ? treasuryResult.data.length : 0;
    results.treasury.details = treasuryResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.treasury.details} - ${results.treasury.count} معاملة`);

    // Test 9: Service Jobs
    console.log('9️⃣ اختبار أوامر التشغيل...');
    const serviceJobsResult = await makeRequest('/api/service-jobs');
    results.serviceJobs.status = serviceJobsResult.status;
    results.serviceJobs.count = Array.isArray(serviceJobsResult.data) ? serviceJobsResult.data.length : 0;
    results.serviceJobs.details = serviceJobsResult.status === 200 ? '✅ يعمل' : '❌ خطأ';
    console.log(`   الحالة: ${results.serviceJobs.details} - ${results.serviceJobs.count} أمر تشغيل`);

    // Test 10: Reports
    console.log('10️⃣ اختبار التقارير...');
    const reportTypes = ['sales', 'purchases', 'stock', 'customers', 'suppliers', 'treasury'];
    let reportsWorking = 0;
    for (const report of reportTypes) {
        const reportResult = await makeRequest(`/api/reports/${report}`);
        if (reportResult.status === 200) reportsWorking++;
    }
    results.reports.status = reportsWorking === reportTypes.length ? 200 : 500;
    results.reports.details = `${reportsWorking}/${reportTypes.length} تقارير تعمل`;
    console.log(`   الحالة: ${results.reports.details}`);

    // Test 11: Create Customer
    console.log('11️⃣ اختبار إنشاء عميل...');
    const customerData = {
        name: `عميل اختبار ${Date.now()}`,
        phone: '01001234567',
        email: 'test@test.com'
    };
    const createCustomerResult = await makeRequest('/api/customers', 'POST', customerData);
    const customerWorking = createCustomerResult.status === 201 ? '✅' : '❌';
    console.log(`   إنشاء عميل: ${customerWorking} (${createCustomerResult.status})`);

    // Test 12: Create Stock Transaction
    console.log('12️⃣ اختبار إنشاء حركة مخزون...');
    const stockData = {
        type: 'inbound',
        date: new Date().toISOString(),
        reference: 'test-' + Date.now(),
        warehouse: 'Main',
        items: [{ product: 'test-product', quantity: 10, unitPrice: 50 }],
        totalAmount: 500,
        notes: 'حركة اختبار'
    };
    const createStockResult = await makeRequest('/api/stock', 'POST', stockData);
    const stockWorking = createStockResult.status === 201 ? '✅' : '❌';
    console.log(`   إنشاء حركة مخزون: ${stockWorking} (${createStockResult.status})`);

    // Test 13: Create Treasury Transaction
    console.log('13️⃣ اختبار إنشاء معاملة خزينة...');
    const treasuryData = {
        date: new Date().toISOString(),
        type: 'expense',
        amount: 100,
        description: 'مصروفات اختبار',
        account: 'Cash'
    };
    const createTreasuryResult = await makeRequest('/api/treasury', 'POST', treasuryData);
    const treasuryWorking = createTreasuryResult.status === 201 ? '✅' : '❌';
    console.log(`   إنشاء معاملة خزينة: ${treasuryWorking} (${createTreasuryResult.status})`);

    // Test 14: Create Service Job
    console.log('14️⃣ اختبار إنشاء أمر تشغيل...');
    const serviceJobData = {
        customerName: `عميل اختبار ${Date.now()}`,
        carMake: 'Toyota',
        carModel: 'Camry',
        carYear: '2022',
        serviceType: 'Full Wrap',
        estimatedCost: 5000,
        status: 'Pending'
    };
    const createServiceJobResult = await makeRequest('/api/service-jobs', 'POST', serviceJobData);
    const serviceJobWorking = createServiceJobResult.status === 201 ? '✅' : '❌';
    console.log(`   إنشاء أمر تشغيل: ${serviceJobWorking} (${createServiceJobResult.status})`);

    // Summary
    console.log('\n📊 ملخص الاختبار الشامل:');
    console.log('=====================================');
    
    const workingModules = Object.values(results).filter(r => r.status === 200).length;
    const totalModules = Object.keys(results).length;
    
    console.log(`🎯 نسبة النجاح: ${workingModules}/${totalModules} (${Math.round(workingModules/totalModules*100)}%)`);
    console.log(`📈 البيانات الحالية:`);
    console.log(`   • الحسابات: ${results.accounts.count}`);
    console.log(`   • العملاء: ${results.customers.count}`);
    console.log(`   • الموردين: ${results.suppliers.count}`);
    console.log(`   • المنتجات: ${results.products.count}`);
    console.log(`   • حركات المخزون: ${results.stock.count}`);
    console.log(`   • فواتير المبيعات: ${results.sales.count}`);
    console.log(`   • فواتير المشتريات: ${results.purchases.count}`);
    console.log(`   • معاملات الخزينة: ${results.treasury.count}`);
    console.log(`   • أوامر التشغيل: ${results.serviceJobs.count}`);
    console.log(`   • التقارير: ${results.reports.details}`);
    
    console.log('\n🔗 روابط الاختبار:');
    console.log(`   • النظام: http://localhost:13620`);
    console.log(`   • التقارير: http://localhost:13620/reports.html`);
    console.log(`   • المخزون: http://localhost:13620/stock.html`);
    console.log(`   • الخزينة: http://localhost:13620/treasury.html`);
    console.log(`   • أوامر التشغيل: http://localhost:13620/service_jobs.html`);
    
    console.log('\n🔑 معلومات التوكن:');
    console.log('   • التوكن يُخزن في localStorage');
    console.log('   • المفتاح: "token"');
    console.log('   • بيانات المستخدم: "user"');
    console.log('   • للوصول: localStorage.getItem("token")');
    
    console.log('\n📝 التقرير للملف:');
    console.log('=====================================');
    console.log(`## تقرير النظام - ${new Date().toISOString().split('T')[0]}`);
    console.log(`### الحالة العامة: ${workingModules}/${totalModules} (${Math.round(workingModules/totalModules*100)}%)`);
    console.log(`### البيانات الحالية:`);
    console.log(`- الحسابات: ${results.accounts.count}`);
    console.log(`- العملاء: ${results.customers.count}`);
    console.log(`- الموردين: ${results.suppliers.count}`);
    console.log(`- المنتجات: ${results.products.count}`);
    console.log(`- حركات المخزون: ${results.stock.count}`);
    console.log(`- فواتير المبيعات: ${results.sales.count}`);
    console.log(`- فواتير المشتريات: ${results.purchases.count}`);
    console.log(`- معاملات الخزينة: ${results.treasury.count}`);
    console.log(`- أوامر التشغيل: ${results.serviceJobs.count}`);
    console.log(`- التقارير: ${results.reports.details}`);
    console.log(`### الوحدات العاملة:`);
    Object.entries(results).forEach(([key, value]) => {
        if (value.status === 200) {
            console.log(`- ✅ ${key}: ${value.details}`);
        } else {
            console.log(`- ❌ ${key}: ${value.details || 'خطأ'}`);
        }
    });
    
    return results;
}

fullSystemTest().catch(console.error);
