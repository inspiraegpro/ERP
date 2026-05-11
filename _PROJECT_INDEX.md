# فهرس مراجعات مشروع Wrapstyle ERP

## تاريخ المراجعة: 19/4/2026

---

## 📂 التقارير المتاحة

| التقرير | المسار | المحتوى |
|---------|--------|---------|
| **صفحات الواجهة** | `public/_PAGES_REVIEW.md` | مراجعة 38+ صفحة HTML |
| **الـ Models** | `_MODELS_REVIEW.md` | مراجعة 19+ Model |
| **الـ Routes** | `_ROUTES_REVIEW.md` | مراجعة 23+ Route |
| **الـ Services** | `_SERVICES_REVIEW.md` | مراجعة 9+ Service |
| **قاعدة البيانات** | `_DATA_STORAGE_REVIEW.md` | مراجعة 30+ مجلد |

---

## 🎯 ملخص سريع للمشروع

### إجمالي الملفات:
| الفئة | العدد | النشط | يحتاج مراجعة | مهمل |
|-------|-------|-------|---------------|------|
| صفحات HTML | 38+ | 14 | 10 | 4 |
| Models | 19+ | 16 | 3 | 3 |
| Routes | 23+ | 21 | 2 | 3 |
| Services | 9+ | 8 | 1 | 1 |
| مجلدات بيانات | 30+ | 28 | 2 | - |

### ⚠️ المشاكل العاجلة:
1. **inventoryRoutes.js** - معطل (argument handler must be a function)
2. **rollbalances/** - مجلد فيه 6 ملفات قديمة محتاجة مراجعة
3. **Products + Pricing** - فيه تكرار محتاج دمج

### ✅ التطويرات الجديدة:
1. **linkedInventoryCodes** - ربط الخامات بالمخزون
2. **selectedInventoryCode** - اختيار الكود المخزني في أوامر التشغيل
3. **workflow جديد** - Sales → Service Jobs → Stock Out

---

## 🔗 روابط سريعة للمراجعة

### 1. صفحات الواجهة (Frontend):
```
public/_PAGES_REVIEW.md
```
- ✅ النشطة والظاهرة: 14 صفحة
- ⚠️ العاملة لكن مخفية: 12 صفحة
- 🔧 العاملة لكن منفصلة: 10 صفحات
- ❌ المهملة: 4 صفحات

### 2. الطبقة المنطقية (Backend):
```
_MODELS_REVIEW.md       - الـ Models
_ROUTES_REVIEW.md       - الـ API Routes
_SERVICES_REVIEW.md     - الـ Business Logic
```

### 3. قاعدة البيانات:
```
_DATA_STORAGE_REVIEW.md
```
- 30 مجلد
- 28 نشط
- 2 يحتاج مراجعة

---

## 📋 قائمة المهام المقترحة

### عاجل (Priority: High):
- [ ] إصلاح `inventoryRoutes.js`
- [ ] مراجعة `rollbalances/` folder
- [ ] حذف `invoice_print_old.html`

### متوسط (Priority: Medium):
- [ ] دمج `product_card.html` مع `products.html`
- [ ] دمج `employees_list.html` مع `hr.html`
- [ ] إضافة روابط لـ `stock_verification.html` و `cutting_planner.html`

### منخفض (Priority: Low):
- [ ] إعادة تسمية `InventoryPiece.js` → `InventoryItem.js`
- [ ] تنظيف `audit_logs/`
- [ ] حذف `accountService_old.js`

---

## 🔄 Workflow التطوير الحالي

```
┌─────────────────┐
│   Sales Invoice   │
│  (PPF Selection)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Service Jobs   │
│ (Inventory Code │
│  Selection)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Stock Out    │
│  (Issue p2/c)   │
└─────────────────┘
```

---

## 📊 حالة السيرفر

| البيان | الحالة |
|--------|--------|
| Server Status | ✅ Running on port 13620 |
| Product Model | ✅ Working (setDb: function) |
| Main APIs | ✅ All working |
| Inventory Routes | ❌ Disabled (error) |

---

*تم إنشاء هذا الفهرس لتسهيل التنقل بين التقارير*
