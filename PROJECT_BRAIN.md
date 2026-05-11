# Wrapstyle ERP Project Brain

## Purpose
This file is the persistent technical memory for Wrapstyle ERP. It is meant to stay alive with the project, not capture a one-time snapshot. Use it to understand what is actually running, what is pending, what should not be touched casually, and how to verify the system safely before and after changes.

## Source of Truth
- Runtime frontend: `public/`
- Runtime backend: `server.js`, `Routes/`, `services/`, `middleware/`, `models/`
- Live operational data: `data_storage/`
- Data backups only: `backups/`
- Legacy code reference only: `_zip_full/`, `inspera_backup.zip`
- Do not develop from legacy snapshots unless explicitly restoring business logic from them.

## Current Runtime
- Backend entry point: `server.js`
- One-click startup: `start_app.bat`
- Default local URL: `http://localhost:13620`
- Runtime stack: `Node.js`, `Express`, local JSON/file storage via `file_db_manager.js`

## Current Stack (with versions)
- Node package name: `inspera_erp`
- App version: `1.0.0`
- express: `^5.1.0`
- jsonwebtoken: `^9.0.3`
- multer: `^2.0.2`
- xlsx: `^0.18.5`
- archiver: `^7.0.1`
- axios: `^1.13.2`
- cors: `^2.8.5`
- dotenv: `^17.2.3`
- morgan: `^1.10.1`
- body-parser: `^2.2.0`

## Core Folder Map
- `Routes/`: Express route modules by business domain
- `services/`: core business logic and posting logic
- `models/`: file-backed models and domain entities
- `middleware/`: auth, audit, backup, errors
- `public/`: HTML/CSS/JS frontend screens
- `data_storage/`: persisted operational data as JSON collections
- `backups/`: snapshot and zip backups
- `tests/`: test assets
- `_zip_full/`: extracted legacy reference snapshot

## Quick Runtime Surface

### Core Backend Files
- `server.js`
- `file_db_manager.js`
- `Routes/stockRoutes.js`
- `Routes/purchaseRoutes.js`
- `Routes/salesRoutes.js`
- `Routes/treasuryRoutes.js`
- `Routes/reportRoutes.js`
- `Routes/hrRoutes.js`
- `Routes/serviceJobRoutes.js`
- `services/inventoryService.js`
- `services/purchaseService.js`
- `services/salesService.js`
- `services/treasuryService.js`

### Core Frontend Screens
- `public/login.html`
- `public/index.html`
- `public/stock_in.html`
- `public/stock_out.html`
- `public/purchase_invoice.html`
- `public/import_shipment.html`
- `public/sales_invoice.html`
- `public/service_jobs.html`
- `public/invoice_print.html`
- `public/treasury.html`
- `public/financial_reports.html`
- `public/reports.html`
- `public/admin_dashboard.html`
- `public/car_coding.html`
- `public/employees_list.html`
- `public/employee_coding.html`

### Core Storage Collections
- `accounts`
- `products`
- `customers`
- `suppliers`
- `purchaseinvoices`
- `salesinvoices`
- `stocktransactions`
- `rollbalances`
- `treasurytransactions`
- `journal`
- `users`
- `audit_logs`
- `employees`
- `import_shipments`
- `servicejobs`

## Module Status
| Module | UI | Backend | Data Flow | Status | Notes |
|--------|----|---------|-----------|--------|-------|
| Authentication | OK | OK | OK | Stable | login and auth endpoints active |
| Dashboard | OK | OK | OK | Stable | `index.html` + executive stats |
| Stock In/Out | OK | OK | OK | Stable | `PUT` update logic active, no delete/recreate |
| Purchases | Mixed | OK | Mixed | Needs review | business-rich UX restoration still important |
| Import Shipments | Mixed | OK | Mixed | Needs review | import cost details should be preserved |
| Sales | OK | OK | OK | Stable | integrated with stock and journal |
| Service Jobs / Operations | OK | OK | OK | Stable | `sales_invoice` now creates `servicejobs`; `stock_out` syncs issue status and updates workflow |
| Treasury | OK | OK | OK | Stable | `accountId` mapping aligned with UI |
| Reports | Mixed | OK | Mixed | Mixed | core reports work, some legacy shells still need review |
| HR | Partial | Partial | Partial | Partial | base screens/storage exist, needs polishing |
| Cars | Mixed | Partial | Partial | Needs review | keep business-specific logic intact |
| Data Import | OK | OK | Mixed | Mixed | preview exists, validation still needs hardening |
| Backups | OK | OK | OK | Stable | zip + snapshot backups working |

## Decisions Made
- Keep current Node + HTML architecture for now.
- Preserve frontend field names such as `warehouse`, `items`, `jobOrder`, `accountId`, and `type` for compatibility.
- Use safe stock update logic through `PUT` instead of delete-and-recreate.
- Keep relative `/api/...` URLs instead of hardcoded localhost references in active pages.
- Treat `_zip_full/` and `inspera_backup.zip` as business-logic recovery references, not runtime.
- When restoring business-rich screens, apply shared header/theme/UTF-8 fixes on top of the original logic, not the other way around.

## Pending Decisions
- [ ] هل ننقل من JSON storage إلى SQLite أو PostgreSQL؟ → مؤجل
- [ ] هل ندمج `smart_reports.html` مع `financial_reports.html`؟ → قيد المراجعة
- [ ] هل نضيف role-based access control كامل على كل الشاشات والـ routes؟ → مطلوب استكمال تدريجي
- [ ] هل نعيد بناء بعض الشاشات business-rich من النسخ المرجعية بالكامل أم ندمجها جزئيًا؟ → حسب كل موديول
- [ ] هل نضيف warehouse matching engine ذكي لموديول الصرف؟ → مطروح للتنفيذ القادم

## External Integrations
| Integration | Status | Last Tested | Notes |
|-------------|--------|-------------|-------|
| Excel Import (`xlsx`) | Working | 2026-04-03 | preview exists, mappings need hardening |
| Snapshot Backup | Working | 2026-04-03 | via admin + backend snapshot route |
| Zip Backup | Working | 2026-04-03 | available in backup manager |
| Email Reports | On Hold | - | no active implementation yet |
| NAS / external backup target | Not Yet | - | planned only |

## API Map

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Master Data
- `/api/accounts`
- `/api/products`
- `/api/customers`
- `/api/suppliers`
- `/api/warehouses`
- `/api/car`
- `/api/cost-centers`

### Transactions
- `/api/sales`
- `/api/purchases`
- `/api/stock`
- `/api/treasury`
- `/api/payment`
- `/api/journal`
- `/api/import-shipments`
- `/api/service-jobs`
- `/api/hr`

### Reports
- `GET /api/reports/dashboard-stats`
- `GET /api/reports/dashboard-executive`
- `GET /api/reports/cfo-dashboard`
- `GET /api/reports/suppliers-balance-summary`
- `GET /api/reports/supplier-statement`
- `GET /api/reports/sales-analysis`
- `GET /api/reports/trial-balance`
- `GET /api/reports/general-ledger`
- `GET /api/reports/financial-statement`
- `GET /api/reports/stock-current`

### Admin/System
- `/api/admin/dashboard`
- `/api/admin/audit-logs`
- `/api/admin/audit-stats`
- `/api/admin/backup/create`
- `/api/admin/backup/snapshot`
- `/api/admin/backup/list`
- `/api/admin/backup/restore`
- `/api/admin/system/cleanup`

### Data Import/Export
- `GET /api/data/export/:type`
- `POST /api/data/import/:type`
- `POST /api/data/preview-import/:type`
- `POST /api/data/delete-range`
- `DELETE /api/data/nuke-everything`
- `GET /api/data/template-import-shipment`
- `POST /api/data/import-import-shipment`

## Accounting and Operational Rules in Force
- Stock receipt and issue flows accept frontend field names as-is, especially `warehouse`, `items`, `jobOrder`, `accountId`, and `type`.
- Sales workflow for Wrapstyle is now defined as: Sales Invoice -> Service Job / Technician Assignment -> Warehouse Issue -> Technician Evaluation -> Treasury Receipt.
- Stock edit flow is not based on delete-and-recreate for `stock_in` and `stock_out`; backend update logic reverses the old effect then applies the new state.
- Sales invoice creation should not consume stock directly; warehouse issue is posted later from the stock out stage against the `jobOrder`.
- Roll balances are maintained in `rollbalances` and updated on stock outbound consumption.
- Treasury flow accepts UI-oriented fields such as `accountId`, `type`, `amount`, `reference`, and `description`.
- Executive dashboard active users are estimated from `audit_logs` activity within the last 15 minutes.
- Backend governance is enforced for major update/delete operations on stock, treasury, sales, purchase, and HR mutation routes.
- Backup system supports both zip backups and instant snapshot directory backups.

## Reports Review

### Confirmed Existing Reports
- `public/financial_reports.html`: canonical professional finance center
- `public/reports.html`: live reports hub
- `public/smart_reports.html`: older advanced analytical screen still present for review
- domain-specific reports:
  - `sales_report.html`
  - `stock_report.html`
  - `treasury_report.html`
  - `inventory_status.html`
  - `job_profitability.html`
  - `sales_analysis.html`
  - `payroll_analysis.html`

### What Works Reliably
- `dashboard-executive`
- `cfo-dashboard`
- `trial-balance`
- `general-ledger`
- `financial-statement`
- `stock-current`
- supplier balance/statement routes
- `service_jobs.html` workflow UI with technician assignment, warehouse issue link, and evaluation
- `invoice_print.html` job-order-style print layout

### What Needs Review / Repair
- some legacy Arabic text remains mojibake in older page content
- some auxiliary report shells still assume response shapes that do not match current payloads
- integrity-check UI in `data_management.html` references journal integrity endpoints not yet implemented
- service job status transitions should be hardened and validated in backend before accepting workflow changes

## Excel Import Review
- `xlsx` is installed and used.
- Existing import/export logic lives in `Routes/dataRoutes.js`.
- Current import/export supports:
  - accounts
  - products
  - customers
  - suppliers
  - purchases
  - sales
  - stock
  - treasury
  - payroll
  - import shipments
- Current weakness:
  - preview/validation exists, but module-by-module mapping checks still need hardening
  - frontend data center still references unfinished integrity work

## Governance Review
- Audit logging exists in `middleware/auditLogger.js`.
- Current enforced state:
  - major listing pages hide edit/delete buttons for non-admin users in the UI
  - backend update/delete protection exists on major transaction routes
  - edited core mutation pages pass authenticated context consistently
- Remaining governance gap:
  - legacy pages outside the rebuilt production surface still need normalization

## Known Issues & Workarounds
| Issue | Workaround | Target Fix |
|------|------------|------------|
| Arabic mojibake still exists in some legacy pages | use the rebuilt screens where available and fix page-by-page | rolling fix |
| `data_management.html` references journal integrity endpoints not fully implemented | skip that integrity action or verify manually from journal reports | pending |
| Purchases/import UX may have lost some Wrapstyle-specific detail during cleanup phases | restore from reference snapshot or preserved business-rich screens only | high priority |
| Legacy detail pages still vary in role gating depth | rely on backend protection even when UI is inconsistent | rolling fix |
| Some reporting shells may not match current response shapes | use `financial_reports.html` as the canonical reporting surface | rolling fix |

## Recovery Notes
- Best known full legacy business snapshot: `_zip_full/`
- `inspera_backup.zip` is a reference archive, not runtime
- Best known post-legacy improved stock receipt reference: the business-rich `stock_in.html` variant preserved during restoration review
- When restoring old modules, preserve business logic first, then add shared header/theme/UTF-8 fixes only

## Do Not Touch Without Review
- `public/stock_in.html`
- `public/stock_out.html`
- `public/purchase_invoice.html`
- `public/import_shipment.html`
- `public/car_coding.html`
- `services/inventoryService.js`
- `Routes/stockRoutes.js`
- any restored business-rich screen whose logic came from legacy recovery work

## Pre-Deployment Checklist
1. [ ] Run `node test-quick.js`
2. [ ] Take a manual snapshot backup
3. [ ] Verify `data_storage/employees/index.json` exists
4. [ ] Test at least one login flow
5. [ ] Review the latest audit log entries
6. [ ] Test one stock receipt and one stock issue if posting logic changed
7. [ ] Confirm `start_app.bat` still launches `server.js`

## Core Test Scenarios
1. **Purchase -> Stock In -> Treasury Payment**
   - create purchase
   - receive into stock
   - settle from treasury
2. **Sales -> Stock Out -> Treasury Receipt**
   - create sale
   - issue from stock
   - receive into treasury
3. **Employee -> Payroll**
   - create employee
   - generate payroll
   - print payslip
4. **Import Shipment -> Stock In**
   - create or import shipment
   - load shipment lines into stock receipt
   - verify landed cost data remains intact

## Review and Numeric Verification
- Existing verification scripts in project root:
  - `full-system-test.js`
  - `test-quick.js`
- Previously confirmed smoke-test results:
  - purchase flow reached storage and journal correctly
  - stock inbound/outbound updated `stocktransactions` and `rollbalances`
  - treasury receipt/payment wrote correct `accountId` values
  - sales flow affected stock and journal successfully
  - tested cycle remained numerically consistent
- Operational rule:
  - after major posting/import changes, append verification notes here instead of relying on memory only

## Health Metrics
- Last updated: 2026-04-09
- API response time: not instrumented yet
- `data_storage/` size: not measured in this document yet
- Active users: estimated from audit activity, not true session tracking
- Backup success rate: last functional checks passed
- Pending audit reviews: manual, not auto-counted

## HR / Employees Review
- HR module exists.
- Current evidence:
  - `Routes/hrRoutes.js`
  - `public/employees_list.html`
  - `public/employee_coding.html`
  - `public/payroll.html`
  - `public/payroll_management.html`
  - `public/payroll_analysis.html`
  - `public/payslip.html`
- Current HR status:
  - employee CRUD exists
  - payroll generation exists
  - payroll import variables from Excel exists
  - salary increment / termination / vacation reset exist
- Production readiness update:
  - employee storage folder exists explicitly
  - HR mutation endpoints are admin-protected from backend
  - primary employee screens use relative paths instead of localhost

## Quick Links
- `./PROJECT_BRAIN.md`
- `./start_app.bat`
- `./Routes/reportRoutes.js`
- `./Routes/dataRoutes.js`
- `./public/financial_reports.html`
- `./public/data_management.html`
- `./public/stock_in.html`
- `./public/stock_out.html`
- `./_zip_full/`
- `./inspera_backup.zip`

## Confirmed Implemented Work

### Phase 1 Stabilization
- `file_db_manager.js`
  - auto-creates collection directories on first write
- `services/inventoryService.js`
  - normalizes `warehouse` and `items`
  - validates inbound/outbound payloads
  - supports safe transaction update logic
  - reverses stock effect on delete
- `Routes/stockRoutes.js`
  - added `PUT /api/stock/:id`
  - hydrates product objects for edit screens
  - improved roll and warehouse filtering
- `Routes/purchaseRoutes.js`
  - added `GET /api/purchases/number/:invoiceNumber`
- `Routes/salesRoutes.js`
  - improved invoice hydration for stock issue screen
- `Routes/warehouseRoutes.js`
  - fallback default warehouse behavior
- `services/treasuryService.js`
  - mapped frontend treasury fields to backend logic
- `Routes/treasuryRoutes.js`
  - aligned treasury routes with frontend contract

### Smoke-Tested Working Data Flow
- purchase creation
- stock inbound
- stock outbound
- treasury income/expense
- sales creation
- journal posting
- roll balance updates

### Phase 2 UX
- `public/index.html`
  - executive dashboard
  - quick access for stock receipt and issue
  - admin-only KPI section
- `public/improved-styles.css`
  - official business palette applied
- `Routes/reportRoutes.js`
  - `GET /api/reports/dashboard-executive`

### Phase 2/3 Backup + UX Continuation
- `middleware/backupManager.js`
  - snapshot backup support
- `Routes/adminRoutes.js`
  - `POST /api/admin/backup/snapshot`
- `public/admin_dashboard.html`
  - one-click snapshot backup
- `public/stock_in.html`
  - business UI + safe `PUT` edit flow
- `public/stock_out.html`
  - business UI + safe `PUT` edit flow

### Sustainability Additions
- `PROJECT_BRAIN.md`
  - persistent architecture and project memory file added
- `start_app.bat`
  - one-click startup file added
- `Routes/dataRoutes.js`
  - import preview route added: `POST /api/data/preview-import/:type`
- `public/data_management.html`
  - preview/validation step added before import
- list pages updated for UI governance:
  - `public/stock_report.html`
  - `public/treasury_report.html`
  - `public/purchase_list.html`
  - `public/sales_list.html`
  - print remains available, edit/delete shown to admin only in UI
- `middleware/auditLogger.js`
  - now attempts to resolve user identity from JWT header even when route middleware does not explicitly attach `req.user`

### Production Phase Additions
- `public/login.html`
  - rebuilt with clean UTF-8 Arabic
  - now logs in through relative paths and redirects to `index.html`
- `public/financial_reports.html`
  - rebuilt as the canonical professional reports center
  - uses relative APIs only
  - includes KPI cards and chart canvases for:
    - cash flow
    - profitability
    - inventory turnover
  - includes trial balance, income statement, balance sheet, and general ledger panels
- `Routes/reportRoutes.js`
  - added `GET /api/reports/cfo-dashboard`
- `public/stock_in.html`, `public/stock_out.html`, `public/purchase_invoice.html`, `public/sales_invoice.html`, `public/treasury.html`
  - mutation requests send `Authorization` headers for protected update/delete behavior
- `public/global-navigation.js`
  - injects one professional fixed global header into active system pages
- all active HTML pages
  - migrated away from hardcoded localhost API usage to relative routes
- `public/reports.html`
  - rebuilt into a live reports hub instead of a redirect placeholder
- `Routes/hrRoutes.js`
  - protected employee/payroll mutation endpoints with admin-only backend authorization
- `public/employees_list.html`, `public/employee_coding.html`
  - switched to relative HR APIs and authenticated protected operations
- `data_storage/employees/index.json`
  - explicitly created to guarantee HR storage presence

## Recent Changes
- 2026-04-28:
  - Hardened barcode persistence during stock receipt in `services/inventoryService.js`:
    - inbound rolls now store `barcode_id`, `barcodeId`, and `barcode` consistently.
    - inbound pieces/remnants now store barcode fields plus `parentRollCode`.
  - Added smarter stock-out suggestion ranking (`getSmartSuggestions`):
    - filters by selected warehouse when provided.
    - prioritizes candidates that can fit required dimensions/area.
    - ranks by closest width, then lowest waste, with remnants/pieces preferred before full rolls.
  - Updated suggestions endpoint contract in `Routes/inventoryRoutes.js`:
    - `GET /api/inventory/pieces/suggestions/:productId` now accepts `warehouse`.
  - Updated stock-out UI wiring in `public/inventory/stock_out.html`:
    - sends selected warehouse to suggestions API for accurate suggestions per warehouse.
- 2026-04-27:
  - Diagnosed why operations workflow looked broken: server process was running an old load state where `serviceJobRoutes` was not mounted, so `/api/service-jobs` returned `404`.
  - Restarted runtime server and re-verified module routes:
    - `GET /api/service-jobs` now returns `200`.
    - `POST /api/service-jobs/sync-missing-from-sales` now reaches auth middleware (`401` without token), which confirms route mounting.
  - Fixed product linkage endpoints in `Routes/productRoutes.js`:
    - removed invalid instance calls and switched to model static methods.
    - `GET /api/products/:id/linked-inventory` now returns `product + linkedInventoryCodes + linkedItems`.
  - Fixed pricing products endpoint in `Routes/pricingRoutes.js`:
    - replaced `Product.findAll()` with `Product.find()`.
  - Hardened invoice initial loading in `public/sales/sales_invoice.html`:
    - added guarded JSON fetch helper to catch non-JSON responses early.
    - switched initial customers/products/cars loading to authenticated guarded calls.
  - Quick verification passed:
    - route require check (`productRoutes`, `pricingRoutes`, `serviceJobRoutes`)
    - runtime call to `GET /api/products/:id/linked-inventory` returned `200`.
- 2026-04-13:
  - Updated company information in invoice_print.html to "WrapStyle Cairo – Empyrean Enterprises", Cloud Nine Mall, Mohamed Naguib Axis, New Cairo, Cairo, Egypt, +2012 00 999 333.
  - Changed issuer signature to "SALES MANAGEMENT" and removed the date signature box in invoice_print.html.
  - Updated contact email to cairo@wrapstyle.com and website to wrapstyle.com in invoice_print.html.
  - Added automatic invoice number generation in salesService.js using sequential numbering based on existing invoices.
  - Added `/api/sales/next-number` so the sales page can prefill the next invoice number.
  - Modified VAT calculation in sales_invoice.html and glLogic.js to treat prices as inclusive of VAT (tax = total * 14/114, netRevenue = total * 100/114).
  - Added commission rate field for sales representatives in sales_invoice.html with percentage input.
  - Included salesPersonName in invoice payload so the print page can show the salesperson name.
  - Updated receivable calculation in glLogic.js to finalTotal - wht for inclusive VAT pricing.
  - Added rollback logic in salesService.js so invoices are deleted if GL entry creation fails.
  - Updated invoice_print.html layout to use a payment receipt style and show receipt number, sales person, service type, VAT, and withholding tax.
  - Changed "مندوب المبيعات" to "وكيل البيع" in sales_invoice.html and invoice_print.html.
  - Made invoice number appear as a suggested value that can be manually edited.

## Session Update Template
```md
## Session Update (YYYY-MM-DD)
**Work done:**
- ...

**New issues discovered:**
- ...

**Decisions made:**
- ...

**Next session priority:**
1. ...
2. ...
```
