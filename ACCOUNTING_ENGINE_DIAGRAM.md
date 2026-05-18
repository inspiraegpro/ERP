# ERP Accounting Flow

```mermaid
flowchart TD
    subgraph UI[Frontend Screens]
        PI["public/purchases/purchase_invoice.html"]
        GP["public/purchases/general_purchase.html"]
        SI["public/sales/sales_invoice.html"]
        PR["public/hr/payroll.html"]
        FS["public/financial_settings.html"]
        CF["public/common-functions.js<br/>Auth.getHeaders()"]
    end

    subgraph API[Express Routes]
        PUR["Routes/purchaseRoutes.js"]
        SAL["Routes/salesRoutes.js"]
        HR["Routes/hrRoutes.js"]
        FSR["Routes/financialSettingsRoutes.js"]
    end

    subgraph Services[Backend Services]
        PS["services/purchaseService.js"]
        SS["services/salesService.js"]
        JS["services/journalService.js<br/>Accounting Engine"]
        FSS["services/financialSettingsService.js"]
        GLL["services/glLogic.js"]
    end

    subgraph Models[Models / Tables]
        PI_T["data_storage/purchaseinvoices/index.json"]
        SI_T["data_storage/salesinvoices/index.json"]
        PY_T["data_storage/payrolls/index.json"]
        JR_T["data_storage/journal/index.json"]
        AU_T["data_storage/audit_logs/index.json"]
        FS_T["data_storage/financial_settings/financial_settings.json"]
        FS_I["data_storage/financial_settings/index.json"]
    end

    CF --> PI
    CF --> GP
    CF --> SI
    CF --> PR
    CF --> FS

    PI --> PUR
    GP --> PUR
    SI --> SAL
    PR --> HR
    FS --> FSR

    PUR --> PS
    SAL --> SS
    HR --> JS
    FSR --> FSS

    PS --> JS
    SS --> JS
    JS --> GLL

    PS --> PI_T
    SS --> SI_T
    HR --> PY_T

    JS --> JR_T
    JS --> AU_T
    JS --> FS_T
    FSS --> FS_T
    FSS --> FS_I
```

## Notes

- `purchase_invoice.html` and `general_purchase.html` now send business data only, without account selectors.
- `sales_invoice.html` keeps business-only payloads and uses the shared auth helper.
- `payroll.html` no longer asks the user to choose posting accounts manually.
- `journalService.js` is now the central accounting engine for:
  - purchase journals
  - sales journals
  - payroll posting journals
  - balance validation
  - pre-save audit snapshots
- Financial mappings are read from `financial_settings.json`, with sync back to the legacy `index.json`.
