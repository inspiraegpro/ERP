(function () {
    if (window.location.pathname.endsWith("/login.html")) {
        return;
    }

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch (error) {
            return {};
        }
    })();

    // Organized navigation structure with sub-menus
    const navStructure = [
        { href: "/index.html", label: "الرئيسية" },
        {
            label: "المخازن",
            children: [
                { href: "/inventory/stock.html", label: "الرصيد المخزني" },
                { href: "/inventory/stock_in.html", label: "إذن وارد" },
                { href: "/inventory/stock_out.html", label: "إذن صرف" },
                { href: "/inventory/stock_transfer.html", label: "التحويلات" },
                { href: "/inventory/products.html", label: "المنتجات" },
                { href: "/inventory/warehouses.html", label: "المستودعات" },
                { href: "/inventory/inventory_barcodes.html", label: "الباركود" },
                { href: "/inventory/cutting_planner.html", label: "مخطط القص" },
                { href: "/inventory/roll_status.html", label: "حالة الرولات" },
                { href: "/inventory/stock_balance_tree.html", label: "شجرة الأرصدة" },
                { href: "/inventory/stock_verification.html", label: "التحقق المخزني" },
                { href: "/warehouse_dashboard.html", label: "داشبورد المخزن" }
            ]
        },
        {
            label: "المبيعات",
            children: [
                { href: "/sales/sales_invoice.html", label: "فاتورة مبيعات" },
                { href: "/sales/sales_list.html", label: "سجل الفواتير" },
                { href: "/sales/customers.html", label: "العملاء" },
                { href: "/sales/pricing_matrix.html", label: "ماتريكس الأسعار" },
                { href: "/sales/sales_agents.html", label: "مناديب المبيعات" },
                { href: "/sales/customer_statement.html", label: "كشف حساب عميل" }
            ]
        },
        {
            label: "التشغيل",
            children: [
                { href: "/service/service_jobs.html", label: "أوامر التشغيل" },
                { href: "/service/car_coding.html", label: "ترميز السيارات" }
            ]
        },
        {
            label: "المشتريات",
            children: [
                { href: "/purchases/purchase_invoice.html", label: "فاتورة مشتريات" },
                { href: "/purchases/purchase_list.html", label: "سجل المشتريات" },
                { href: "/purchases/suppliers.html", label: "الموردين" }
            ]
        },
        {
            label: "المالية",
            children: [
                { href: "/financial/financial.html", label: "الدليل المحاسبي" },
                { href: "/financial/journal.html", label: "القيود اليومية" },
                { href: "/financial/treasury.html", label: "الخزينة" },
                { href: "/financial/accounts.html", label: "الحسابات" },
                { href: "/financial/cost_centers.html", label: "مراكز التكلفة" },
                { href: "/financial/financial_reports.html", label: "التقارير المالية" },
                { href: "/reports/smart_reports.html", label: "📊 BI Dashboard" },
                { href: "/financial_settings.html", label: "إعدادات مالية" }
            ]
        },
        {
            label: "الموارد البشرية",
            children: [
                { href: "/hr/hr.html", label: "الموظفين" },
                { href: "/hr/employees_list.html", label: "قائمة الموظفين" },
                { href: "/hr/payroll.html", label: "الرواتب" },
                { href: "/hr/payroll_management.html", label: "إدارة الرواتب" },
                { href: "/hr/technicians.html", label: "الفنيين" }
            ]
        }
    ];

    // Admin menu (role-based)
    if (String(user.role || "").toLowerCase() === "admin" || String(user.role || "").toLowerCase() === "مدير مالي") {
        navStructure.push({
            label: "أدمن",
            children: [
                { href: "/admin/admin_dashboard.html", label: "داشبورد الأدمن" },
                { href: "/admin/data_management.html", label: "إدارة البيانات" },
                { href: "/admin/settings.html", label: "الإعدادات" },
                { href: "/admin/audit_logs.html", label: "سجلات التدقيق" },
                { href: "/admin/file_manager.html", label: "إدارة الملفات" }
            ]
        });
    }

    const currentPage = window.location.pathname;
    // Normalize current page path for active state matching
    const normalizedCurrentPage = (currentPage === '/' || currentPage === '/index.html') ? '/index.html' : currentPage;

    const style = document.createElement("style");
    style.textContent = `
        body.global-nav-ready {
            padding-top: 82px !important;
        }
        .global-nav-shell {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1200;
            background: rgba(255,255,255,0.97);
            backdrop-filter: blur(14px);
            border-bottom: 1px solid rgba(22, 58, 95, 0.1);
            box-shadow: 0 12px 34px rgba(22, 58, 95, 0.08);
        }
        .global-nav-inner {
            max-width: 1400px;
            margin: 0 auto;
            min-height: 72px;
            padding: 0 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }
        .global-nav-brand {
            color: #163a5f;
            text-decoration: none;
            font-weight: 800;
            font-size: 1.1rem;
            white-space: nowrap;
        }
        .global-nav-links {
            display: flex;
            align-items: center;
            gap: 0.45rem;
            flex-wrap: wrap;
            justify-content: center;
        }
        .global-nav-link,
        .global-nav-logout {
            border: 1px solid transparent;
            border-radius: 999px;
            padding: 0.65rem 0.95rem;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.92rem;
            transition: all 0.18s ease;
            cursor: pointer;
        }
        .global-nav-link {
            color: #526277;
            background: transparent;
        }
        .global-nav-link:hover {
            color: #163a5f;
            background: rgba(22, 58, 95, 0.06);
            border-color: rgba(22, 58, 95, 0.08);
        }
        .global-nav-link.active {
            color: #fff;
            background: #163a5f;
            box-shadow: 0 10px 18px rgba(22, 58, 95, 0.16);
        }
        .nav-dropdown {
            position: relative;
            display: inline-block;
        }
        .nav-dropdown-content {
            display: none;
            position: absolute;
            background: rgba(255,255,255,0.98);
            min-width: 220px;
            box-shadow: 0 12px 34px rgba(22, 58, 95, 0.15);
            border-radius: 12px;
            border: 1px solid rgba(22, 58, 95, 0.1);
            z-index: 1201;
            top: 100%;
            right: 0;
            margin-top: 8px;
            padding: 8px 0;
        }
        .nav-dropdown:hover .nav-dropdown-content {
            display: block;
        }
        .nav-dropdown-item {
            display: block;
            padding: 10px 16px;
            color: #526277;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.15s ease;
            border-bottom: 1px solid rgba(22, 58, 95, 0.05);
        }
        .nav-dropdown-item:last-child {
            border-bottom: none;
        }
        .nav-dropdown-item:hover {
            background: rgba(22, 58, 95, 0.06);
            color: #163a5f;
        }
        .nav-dropdown-item.active {
            background: rgba(22, 58, 95, 0.1);
            color: #163a5f;
        }
        .global-nav-right {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            flex-wrap: wrap;
            justify-content: flex-end;
        }
        .global-nav-user {
            color: #526277;
            font-weight: 700;
            font-size: 0.9rem;
            white-space: nowrap;
        }
        .global-nav-logout {
            background: #b98918;
            color: #fff;
            border-color: rgba(185, 137, 24, 0.2);
        }
        .global-nav-logout:hover {
            background: #a97a0f;
            transform: translateY(-1px);
        }
        .global-nav-back-btn {
            background: rgba(22, 58, 95, 0.05);
            border: 1px solid rgba(22, 58, 95, 0.1);
            color: #163a5f;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .global-nav-back-btn:hover {
            background: #163a5f;
            color: #fff;
            transform: scale(1.05);
        }
        @media (max-width: 960px) {
            body.global-nav-ready {
                padding-top: 118px !important;
            }
            .global-nav-inner {
                padding: 0.75rem 1rem;
                align-items: flex-start;
                min-height: 98px;
                flex-direction: column;
            }
            .global-nav-links,
            .global-nav-right {
                width: 100%;
                justify-content: flex-start;
            }
        }
    `;
    document.head.appendChild(style);

    const existingNavbar = document.querySelector(".navbar");
    if (existingNavbar) {
        existingNavbar.remove();
    }

    const shell = document.createElement("div");
    shell.className = "global-nav-shell";
    shell.innerHTML = `
        <div class="global-nav-inner">
            <div style="display: flex; align-items: center; gap: 15px;">
                <button type="button" class="global-nav-back-btn" onclick="history.back()" title="رجوع">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <a class="global-nav-brand" href="/index.html">Wrapstyle ERP</a>
            </div>
            <nav class="global-nav-links">
                ${navStructure.map((item) => {
                    if (item.children) {
                        const hasActiveChild = item.children.some(c => normalizedCurrentPage === c.href);
                        return `
                            <div class="nav-dropdown">
                                <a href="#" class="global-nav-link ${hasActiveChild ? "active" : ""}">${item.label} ▾</a>
                                <div class="nav-dropdown-content">
                                    ${item.children.map(child => `
                                        <a href="${child.href}" class="nav-dropdown-item ${normalizedCurrentPage === child.href ? "active" : ""}">${child.label}</a>
                                    `).join("")}
                                </div>
                            </div>
                        `;
                    }
                    return `
                        <a href="${item.href}" class="global-nav-link ${normalizedCurrentPage === item.href ? "active" : ""}">${item.label}</a>
                    `;
                }).join("")}
            </nav>
            <div class="global-nav-right">
                <span class="global-nav-user" id="userDisplay">${user.name || user.username || "مستخدم النظام"}</span>
                <button type="button" class="global-nav-logout">تسجيل الخروج</button>
            </div>
        </div>
    `;

    document.body.classList.add("global-nav-ready");
    document.body.insertBefore(shell, document.body.firstChild);

    shell.querySelector(".global-nav-logout").addEventListener("click", function () {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login.html";
    });
})();
