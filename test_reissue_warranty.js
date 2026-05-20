/**
 * Test Script: Reissue Requests + Warranty Requests
 * Run: node test_reissue_warranty.js
 */

const BASE = 'http://localhost:13620/api';
let TOKEN = '';

// ─── helpers ────────────────────────────────────────────────────────────────
async function req(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${BASE}${path}`, opts);
    const json = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, data: json };
}

function pass(label) { console.log(`  ✅ PASS  ${label}`); }
function fail(label, detail) { console.log(`  ❌ FAIL  ${label}`); if (detail) console.log(`         → ${detail}`); }
function section(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

// ─── login ───────────────────────────────────────────────────────────────────
async function login() {
    section('0. تسجيل الدخول');
    const r = await req('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    if (r.ok && r.data.token) {
        TOKEN = r.data.token;
        pass(`تسجيل الدخول — token: ${TOKEN.slice(0, 30)}...`);
    } else {
        fail('تسجيل الدخول', JSON.stringify(r.data));
        process.exit(1);
    }
}

// ─── REISSUE TESTS ───────────────────────────────────────────────────────────
async function testReissue() {
    section('1. طلبات إعادة الصرف (Reissue Requests)');

    // ── 1.1 type: mistake ────────────────────────────────────────────────────
    console.log('\n  [1.1] إنشاء طلب إعادة — type: mistake');
    const r1 = await req('POST', '/reissue-requests', {
        originalJobId: 'test-job-001',
        originalItemIndex: 0,
        type: 'mistake',
        reason: 'خطأ في القياسات'
    });
    if (r1.ok && r1.data._id) {
        pass(`تسجّل بـ _id: ${r1.data._id}`);
        const d = r1.data;
        d.type === 'mistake'              ? pass('type = mistake')              : fail('type', `got: ${d.type}`);
        d.status === 'pending_execution'  ? pass('status = pending_execution')  : fail('status', `got: ${d.status}`);
        typeof d.execution === 'object'   ? pass('execution موجود (object)')    : fail('execution', `got: ${typeof d.execution}`);
        typeof d.accounting === 'object'  ? pass('accounting موجود (object)')   : fail('accounting', `got: ${typeof d.accounting}`);
        d.requestedAt                     ? pass(`requestedAt = ${d.requestedAt}`) : fail('requestedAt', 'مش موجود');
        d.requestedBy !== undefined       ? pass(`requestedBy = "${d.requestedBy}"`) : fail('requestedBy', 'مش موجود');
    } else {
        fail('إنشاء طلب mistake', JSON.stringify(r1.data));
    }

    // ── 1.2 type: defective ──────────────────────────────────────────────────
    console.log('\n  [1.2] إنشاء طلب إعادة — type: defective');
    const r2 = await req('POST', '/reissue-requests', {
        originalJobId: 'test-job-002',
        originalItemIndex: 1,
        type: 'defective',
        reason: 'خامة معيبة'
    });
    if (r2.ok && r2.data._id) {
        pass(`تسجّل بـ _id: ${r2.data._id}`);
        r2.data.type === 'defective' ? pass('type = defective') : fail('type', `got: ${r2.data.type}`);
    } else {
        fail('إنشاء طلب defective', JSON.stringify(r2.data));
    }

    // ── 1.3 type غير صحيح → يُصحَّح لـ mistake ──────────────────────────────
    console.log('\n  [1.3] type غير معروف → يُصحَّح لـ mistake');
    const r3 = await req('POST', '/reissue-requests', {
        originalJobId: 'test-job-003',
        originalItemIndex: 0,
        type: 'unknown_type',
        reason: 'اختبار'
    });
    if (r3.ok) {
        r3.data.type === 'mistake' ? pass('type غير معروف → صُحِّح لـ mistake') : fail('type correction', `got: ${r3.data.type}`);
    } else {
        fail('إنشاء طلب type غير معروف', JSON.stringify(r3.data));
    }

    // ── 1.4 بيانات ناقصة → 400 ───────────────────────────────────────────────
    console.log('\n  [1.4] بيانات ناقصة → يجب أن يرجع 400');
    const r4 = await req('POST', '/reissue-requests', { originalJobId: 'x' });
    r4.status === 400 ? pass('بيانات ناقصة → 400') : fail('validation', `got status: ${r4.status}`);

    // ── 1.5 execution و accounting فاضيين ────────────────────────────────────
    console.log('\n  [1.5] execution و accounting فاضيين عند الإنشاء');
    const r5 = await req('POST', '/reissue-requests', {
        originalJobId: 'test-job-005',
        originalItemIndex: 0,
        type: 'mistake',
        reason: 'اختبار الحقول الفارغة'
    });
    if (r5.ok) {
        const exec = r5.data.execution;
        const acc  = r5.data.accounting;
        const execEmpty = exec && Object.keys(exec).length === 0;
        execEmpty ? pass('execution = {} فارغ') : fail('execution', `got: ${JSON.stringify(exec)}`);
        acc && acc.status === 'pending' ? pass('accounting.status = pending') : fail('accounting.status', `got: ${acc?.status}`);
        acc && acc.deductionAmount === 0 ? pass('accounting.deductionAmount = 0') : fail('accounting.deductionAmount', `got: ${acc?.deductionAmount}`);
    } else {
        fail('إنشاء طلب للتحقق من الحقول', JSON.stringify(r5.data));
    }
}

// ─── WARRANTY TESTS ──────────────────────────────────────────────────────────
async function testWarranty() {
    section('2. طلبات الضمان (Warranty Requests)');

    // ── 2.1 ضمان صالح (تاريخ قريب → approved) ───────────────────────────────
    console.log('\n  [2.1] فاتورة حديثة → يجب أن يكون status = approved/converted_to_job');
    const recentDate = new Date();
    recentDate.setFullYear(recentDate.getFullYear() - 2); // قبل سنتين → ضمن الـ 10 سنين
    const r1 = await req('POST', '/warranty-requests', {
        originalInvoiceId: 'INV-TEST-001',
        originalJobId: 'JOB-TEST-001',
        customerName: 'أحمد محمد',
        customerPhone: '01012345678',
        complaint: 'تقشر الطلاء',
        originalInvoiceDate: recentDate.toISOString().split('T')[0],
        items: [{ description: 'طلاء سقف', quantity: 1 }]
    });
    if (r1.ok || r1.status === 201) {
        const d = r1.data.request || r1.data;
        pass(`تسجّل بـ _id: ${d._id}`);
        const validStatuses = ['approved', 'converted_to_job'];
        validStatuses.includes(d.status) ? pass(`status = ${d.status} ✓ (ضمن الـ 10 سنين)`) : fail('status للضمان الصالح', `got: ${d.status}`);
        Array.isArray(d.items) && d.items.length > 0 ? pass(`items array = ${d.items.length} بند`) : fail('items', `got: ${JSON.stringify(d.items)}`);
        d.createdBy !== undefined ? pass(`createdBy = "${d.createdBy}"`) : fail('createdBy', 'مش موجود');
        d.warrantyValidUntil ? pass(`warrantyValidUntil = ${d.warrantyValidUntil}`) : fail('warrantyValidUntil', 'مش موجود');
        // createdAt
        d.createdAt ? pass(`createdAt = ${d.createdAt}`) : fail('createdAt', 'مش موجود');
        // serviceJob
        r1.data.serviceJob ? pass(`serviceJob أُنشئ: ${r1.data.serviceJob.jobOrder || r1.data.serviceJob._id}`) : fail('serviceJob', 'لم يُنشأ رغم أن الضمان صالح');
    } else {
        fail('إنشاء طلب ضمان صالح', JSON.stringify(r1.data));
    }

    // ── 2.2 ضمان منتهي (تاريخ قديم → rejected) ──────────────────────────────
    console.log('\n  [2.2] فاتورة قديمة (> 10 سنين) → يجب أن يكون status = rejected');
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 12); // قبل 12 سنة → خارج الـ 10 سنين
    const r2 = await req('POST', '/warranty-requests', {
        originalInvoiceId: 'INV-OLD-001',
        originalJobId: 'JOB-OLD-001',
        customerName: 'محمد علي',
        customerPhone: '01098765432',
        complaint: 'تلف قديم',
        originalInvoiceDate: oldDate.toISOString().split('T')[0],
        items: [{ description: 'طلاء قديم', quantity: 1 }]
    });
    if (r2.status === 201 || r2.ok) {
        const d = r2.data.request || r2.data;
        d.status === 'rejected' ? pass('status = rejected ✓ (خارج الـ 10 سنين)') : fail('status للضمان المنتهي', `got: ${d.status}`);
        !r2.data.serviceJob ? pass('لم يُنشأ serviceJob (صح)') : fail('serviceJob', 'أُنشئ رغم أن الضمان منتهي');
    } else {
        fail('إنشاء طلب ضمان منتهي', JSON.stringify(r2.data));
    }

    // ── 2.3 بيانات ناقصة → 400 ───────────────────────────────────────────────
    console.log('\n  [2.3] بيانات ناقصة → يجب أن يرجع 400');
    const r3 = await req('POST', '/warranty-requests', { customerName: 'اختبار' });
    r3.status === 400 ? pass('بيانات ناقصة → 400') : fail('validation', `got status: ${r3.status}`);

    // ── 2.4 GET list ──────────────────────────────────────────────────────────
    console.log('\n  [2.4] GET /warranty-requests → قائمة الطلبات');
    const r4 = await req('GET', '/warranty-requests');
    r4.ok && Array.isArray(r4.data) ? pass(`قائمة الطلبات = ${r4.data.length} طلب`) : fail('GET list', JSON.stringify(r4.data));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
    console.log('\n🧪 بدء الاختبارات...\n');
    try {
        await login();
        await testReissue();
        await testWarranty();
        console.log('\n' + '═'.repeat(60));
        console.log('  🏁 انتهت الاختبارات');
        console.log('═'.repeat(60) + '\n');
    } catch (e) {
        console.error('\n💥 خطأ غير متوقع:', e.message);
    }
})();
