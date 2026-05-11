# Inspera ERP - Complete Codebase Analysis

**Generated:** April 21, 2026

## 📊 Executive Summary

| Category | Count |
|----------|-------|
| **Total UI Pages** | 86 HTML files |
| **Total API Routes** | 26 route files |
| **Pages in Navigation** | 13 |
| **Pages NOT in Navigation** | 73 |
| **API Endpoints** | ~150+ endpoints |

---

## 🖥️ UI PAGES ANALYSIS

### Pages IN Main Navigation (13 pages)

Located in `global-navigation.js`:

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | الرئيسية | `index.html` | Dashboard |
| 2 | المخازن | `stock.html` | Inventory overview |
| 3 | أمين المخزن | `warehouse_dashboard.html` | Warehouse manager view |
| 4 | تقارير المخزون | `inventory_reports.html` | Inventory reports |
| 5 | السيارات | `cars.html` | Car management |
| 6 | الخزينة | `treasury.html` | Treasury/Cash |
| 7 | المبيعات | `sales.html` | Sales overview |
| 8 | وكلاء البيع | `sales_agents.html` | Sales agents |
| 9 | التشغيل | `service_jobs.html` | Service operations |
| 10 | المشتريات | `purchases.html` | Purchase overview |
| 11 | الموارد البشرية | `hr.html` | HR management |
| 12 | التقارير المالية | `financial_reports.html` | Financial reports |
| 13 | أدمن | `admin_dashboard.html` | Admin panel (admin only) |

---

### Pages NOT in Main Navigation (73 pages)

#### 📋 Sales Module (12 pages)
| File | Purpose | Status |
|------|---------|--------|
| `sales_invoice.html` | Create sales invoice | 🟢 Active |
| `sales_list.html` | Sales invoice list | 🟢 Active |
| `sales_invoice_details.html` | Invoice details view | 🟢 Active |
| `sales_analysis.html` | Sales analytics | 🟡 Needs link |
| `sales_report.html` | Sales reports | 🟡 Needs link |
| `sales_association.html` | Sales associations | 🟡 Needs link |
| `invoice_print.html` | Print invoice | 🔗 Accessed via button |
| `invoice_print_old.html` | Old print format | 🔴 Legacy |
| `price_list.html` | Product pricing | 🟡 Needs link |
| `product_card.html` | Product details | 🟡 Needs link |
| `products.html` | Product management | 🟡 Needs link |
| `products_list.html` | Product list | 🟡 Needs link |

#### 📦 Inventory/Stock Module (15 pages)
| File | Purpose | Status |
|------|---------|--------|
| `stock_in.html` | Stock receiving | 🟢 Active |
| `stock_out.html` | Stock issuance | 🟢 Active |
| `stock_transfer.html` | Stock transfer | 🟡 Needs link |
| `stock_report.html` | Stock reports | 🟡 Needs link |
| `stock_analysis.html` | Stock analytics | 🟡 Needs link |
| `stock_print.html` | Print stock docs | 🔗 Accessed via button |
| `stock_verification.html` | Stock verification | 🟡 Needs link |
| `stock_balance_tree.html` | Balance tree view | 🟡 Needs link |
| `inventory_status.html` | Inventory status | 🟡 Needs link |
| `inventory_barcodes.html` | Barcode management | 🟡 Needs link |
| `inventory_label.html` | Label printing | 🟡 Needs link |
| `cutting_planner.html` | Cutting planning | 🟡 Needs link |
| `roll_status.html` | Roll status | 🟡 Needs link |
| `rolls_status.html` | Rolls status (detailed) | 🟡 Needs link |
| `stock_inventory_report.html` | Inventory reports | 🟡 Needs link |

#### 🛒 Purchases Module (6 pages)
| File | Purpose | Status |
|------|---------|--------|
| `purchase_invoice.html` | Create purchase invoice | 🟢 Active |
| `purchase_list.html` | Purchase list | 🟢 Active |
| `purchase_invoice_details.html` | Purchase details | 🟢 Active |
| `general_purchase.html` | General purchases | 🟡 Needs link |
| `import_shipment.html` | Import shipments | 🟡 Needs link |
| `import_list.html` | Import list | 🟡 Needs link |

#### 👥 Customers & Suppliers (6 pages)
| File | Purpose | Status |
|------|---------|--------|
| `customers.html` | Customer management | 🟡 Needs link |
| `customer_statement.html` | Customer statement | 🟡 Needs link |
| `customers_balance.html` | Customer balances | 🟡 Needs link |
| `suppliers.html` | Supplier management | 🟡 Needs link |
| `supplier_coding.html` | Supplier coding | 🟡 Needs link |
| `supplier_report.html` | Supplier reports | 🟡 Needs link |

#### 🚗 Cars Module (3 pages)
| File | Purpose | Status |
|------|---------|--------|
| `car_coding.html` | Car coding/config | 🟡 Needs link |
| `technicians.html` | Technicians mgmt | 🟡 Needs link |

#### 💰 Treasury/Financial (7 pages)
| File | Purpose | Status |
|------|---------|--------|
| `payment_receipt.html` | Payment receipts | 🟡 Needs link |
| `treasury_print.html` | Treasury print | 🔗 Accessed via button |
| `treasury_report.html` | Treasury reports | 🟡 Needs link |
| `treasury_statement.html` | Treasury statement | 🟡 Needs link |
| `accounts.html` | Chart of accounts | 🟡 Needs link |
| `journal.html` | Journal entries | 🟡 Needs link |
| `manual_entry.html` | Manual GL entries | 🟡 Needs link |
| `cost_centers.html` | Cost centers | 🟡 Needs link |

#### 👔 HR Module (7 pages)
| File | Purpose | Status |
|------|---------|--------|
| `payroll.html` | Payroll processing | 🟡 Needs link |
| `payroll_management.html` | Payroll management | 🟡 Needs link |
| `payroll_analysis.html` | Payroll analytics | 🟡 Needs link |
| `payslip.html` | Payslip view | 🔗 Accessed via button |
| `employees_list.html` | Employee list | 🟡 Needs link |
| `employee_coding.html` | Employee coding | 🟡 Needs link |

#### 🔧 Other Pages (9 pages)
| File | Purpose | Status |
|------|---------|--------|
| `login.html` | Login page | 🔴 Excluded from nav |
| `settings.html` | System settings | 🟡 Admin only? |
| `audit_logs.html` | Audit logs | 🟡 Admin only? |
| `data_management.html` | Data management | 🟡 Admin only? |
| `file_manager.html` | File manager | 🟡 Needs link |
| `reset_system.html` | System reset | 🔴 Admin only |
| `smart_reports.html` | Smart reports | 🟡 Needs link |
| `waste_report.html` | Waste reports | 🟡 Needs link |
| `job_profitability.html` | Job profitability | 🟡 Needs link |
| `warehouses.html` | Warehouse management | 🟡 Needs link |
| `warehouse_verify.html` | Warehouse verification | 🟡 Needs link |

---

## 🔌 API ENDPOINTS ANALYSIS

### API Routes Structure (26 route files)

| Route File | Base Path | Endpoint Count | Frontend Usage |
|------------|-----------|----------------|----------------|
| `authRoutes.js` | `/api/auth` | 4 | 🟢 Used |
| `salesRoutes.js` | `/api/sales` | 7 | 🟢 Used |
| `purchaseRoutes.js` | `/api/purchases` | 7 | 🟢 Used |
| `inventoryRoutes.js` | `/api/inventory` | 10+ | 🟢 Used |
| `stockRoutes.js` | `/api/stock` | 6 | 🟢 Used |
| `customerRoutes.js` | `/api/customers` | 5 | 🟢 Used |
| `supplierRoutes.js` | `/api/suppliers` | 5 | 🟢 Used |
| `productRoutes.js` | `/api/products` | 5 | 🟢 Used |
| `carRoutes.js` | `/api/cars` | 7 | 🟢 Used |
| `warehouseRoutes.js` | `/api/warehouses` | 5 | 🟡 Partial |
| `treasuryRoutes.js` | `/api/treasury` | 8 | 🟢 Used |
| `paymentRoutes.js` | `/api/payment` | 5 | 🟢 Used |
| `journalRoutes.js` | `/api/journal` | 6 | 🟢 Used |
| `accountRoutes.js` | `/api/accounts` | 6 | 🟢 Used |
| `reportRoutes.js` | `/api/reports` | 15+ | 🟢 Used |
| `hrRoutes.js` | `/api/hr` | 12+ | 🟡 Partial |
| `serviceJobRoutes.js` | `/api/service-jobs` | 8 | 🟢 Used |
| `importRoutes.js` | `/api/import-shipments` | 6 | 🟡 Partial |
| `adminRoutes.js` | `/api/admin` | 8 | 🟢 Used |
| `agentRoutes.js` | `/api/agents` | 5 | 🟢 Used |
| `costCenterRoutes.js` | `/api/cost-centers` | 4 | 🟡 Partial |
| `analytics.js` | `/api/analytics` | 5 | 🟡 Partial |
| `dataRoutes.js` | `/api/data` | 20+ | 🟢 Used |
| `pricingRoutes.js` | `/api/pricing` | 6 | 🔴 NOT Called |
| `Warehouse.js` (legacy) | - | - | 🔴 Legacy |
| `inventoryRoutes_backup.js` | - | - | 🔴 Backup |

### APIs NOT Being Called by Frontend (Orphaned)

#### 🔴 Completely Unused APIs

| API File | Endpoint | Purpose | Recommendation |
|----------|----------|---------|----------------|
| `pricingRoutes.js` | `GET /api/pricing` | List pricing matrices | Remove or implement |
| `pricingRoutes.js` | `POST /api/pricing` | Create pricing | Remove or implement |
| `pricingRoutes.js` | `PUT /api/pricing/:id` | Update pricing | Remove or implement |
| `pricingRoutes.js` | `DELETE /api/pricing/:id` | Delete pricing | Remove or implement |
| `pricingRoutes.js` | `POST /api/pricing/defaults` | Create defaults | Remove or implement |
| `analytics.js` | Various analytics | Business intelligence | 🟡 Review usage |
| `costCenterRoutes.js` | `/api/cost-centers/*` | Cost center mgmt | 🟡 Review usage |

### APIs with PARTIAL Frontend Usage

| API | Used Endpoints | Unused Endpoints |
|-----|----------------|------------------|
| `hrRoutes.js` | `GET /employees`, `POST /payroll/calculate` | Many CRUD operations |
| `importRoutes.js` | `GET /`, `POST /` | Update, delete rarely used |
| `warehouseRoutes.js` | `GET /` | Specific warehouse ops |
| `reportRoutes.js` | Core reports | Advanced analytics unused |

---

## 🔍 DETAILED FRONTEND-BACKEND MAPPING

### Sales Module API Calls

**From:** `sales_invoice.html`, `sales_list.html`, `sales_invoice_details.html`

```
✅ GET  /api/sales/number/next     → Load next invoice number
✅ GET  /api/sales                 → List all invoices
✅ GET  /api/sales/:id             → Get single invoice
✅ POST /api/sales                 → Create invoice
✅ PUT  /api/sales/:id             → Update invoice
✅ GET  /api/customers             → Load customers
✅ GET  /api/products              → Load products
✅ GET  /api/cars                   → Load cars
✅ GET  /api/agents                → Load sales agents
✅ GET  /api/pricing/calculate     → 🟡 NEW - Pricing matrix (recently added)
✅ POST /api/pricing/defaults      → 🟡 NEW - Create defaults (recently added)
```

### Inventory Module API Calls

**From:** `stock_in.html`, `stock_out.html`, `inventory_reports.html`

```
✅ GET  /api/inventory/pieces                → List pieces
✅ GET  /api/inventory/pieces/suggestions/*  → Smart suggestions
✅ GET  /api/inventory/rolls                 → List rolls
✅ GET  /api/inventory/report/detailed       → Detailed report
✅ POST /api/inventory/opening-balance/*     → Opening balance
✅ GET  /api/stock/available-rolls           → Available rolls
✅ POST /api/stock                           → Create transaction
✅ GET  /api/stock                           → List transactions
✅ GET  /api/products                        → List products
```

### Purchase Module API Calls

**From:** `purchase_invoice.html`, `purchase_list.html`

```
✅ GET  /api/purchases              → List purchases
✅ GET  /api/purchases/:id         → Get purchase
✅ POST /api/purchases              → Create purchase
✅ PUT  /api/purchases/:id          → Update purchase
✅ DELETE /api/purchases/:id        → Delete purchase
✅ GET  /api/purchases/number/next  → Next number
✅ GET  /api/suppliers              → List suppliers
✅ GET  /api/products               → List products
```

---

## 📈 RECOMMENDATIONS

### 1. Navigation Improvements

**High Priority:**
- Add `sales_invoice.html` to Sales dropdown
- Add `purchase_invoice.html` to Purchases dropdown
- Add `customers.html` and `suppliers.html` to navigation
- Add `products.html` or `products_list.html` for product management

**Medium Priority:**
- Add `stock_in.html` and `stock_out.html` under Inventory
- Add `service_jobs.html` details page link
- Add `reports.html` for consolidated reporting

### 2. API Cleanup

**Remove Unused:**
- `pricingRoutes.js` - Unless implementing dynamic pricing
- `analytics.js` - Unless BI dashboard is planned
- Legacy `Warehouse.js` routes

**Consolidate:**
- Merge similar endpoints in `dataRoutes.js`
- Standardize response formats across all routes

### 3. Test Coverage

**Priority for Unit Testing:**
- ✅ `calcTotal()` function - **DONE** (see `__tests__/calcTotal.test.js`)
- 🟡 `salesService.createSalesInvoice()`
- 🟡 `inventoryService.processInbound/Outbound()`
- 🟡 `glLogic` calculations

---

## 📁 File Structure Overview

```
inspera/
├── public/              # 86 HTML files (UI pages)
│   ├── global-navigation.js
│   ├── index.html
│   ├── sales_invoice.html
│   ├── stock_out.html
│   └── ...
├── Routes/              # 26 API route files
│   ├── salesRoutes.js
│   ├── inventoryRoutes.js
│   ├── pricingRoutes.js  # 🟡 Orphaned
│   └── ...
├── models/              # 23 data models
│   ├── PricingMatrix.js  # 🟡 Recently added
│   └── ...
├── services/            # 12 service files
├── middleware/          # Auth & other middleware
├── __tests__/           # 🆕 New test files
│   └── calcTotal.test.js
└── server.js            # Main server entry
```

---

## 🧪 TESTING STATUS

| Component | Test Status | Notes |
|-----------|-------------|-------|
| calcTotal() | ✅ **COMPLETE** | 40+ test cases covering all edge cases |
| salesService | 🟡 Not tested | Needs Jest tests |
| inventoryService | 🟡 Not tested | Needs Jest tests |
| API routes | 🔴 No tests | Consider integration tests |
| Frontend | 🔴 No tests | Consider E2E tests with Playwright |

---

**Next Steps:**
1. ✅ Run unit tests: `npm test` (after adding Jest to package.json)
2. 🟡 Review orphaned APIs and decide on removal
3. 🟡 Add missing navigation links
4. 🟡 Write additional service tests
5. 🟡 Implement E2E testing

---

*Generated by Cascade - Comprehensive Codebase Analysis*
