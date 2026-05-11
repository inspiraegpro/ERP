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

    const links = [
        { href: "/index.html", label: "الرئيسية" },
        { href: "/inventory/stock.html", label: "المخازن" },
        { href: "/financial/financial.html", label: "المالية" },
        { href: "/financial_settings.html", label: "إعدادات مالية" }, // إضافة رابط إعدادات مالية
        { href: "/sales/sales.html", label: "المبيعات" },
        { href: "/service/service_jobs.html", label: "التشغيل" },
        { href: "/purchases/purchases.html", label: "المشتريات" },
        { href: "/hr/hr.html", label: "الموارد البشرية" }
    ];

    if (String(user.role || "").toLowerCase() === "admin" || String(user.role || "").toLowerCase() === "مدير مالي") { // تم إضافة "مدير مالي" كصلاحية إضافية
        links.push({ href: "/admin/admin_dashboard.html", label: "أدمن" });
    }

    const currentPathname = window.location.pathname;
    // Normalize current page path for active state matching
    const normalizedCurrentPage = (currentPathname === '/' || currentPathname === '/index.html') ? '/index.html' : currentPathname;

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
                ${links.map((link) => `
                    <a href="${link.href}" class="global-nav-link ${normalizedCurrentPage === link.href ? "active" : ""}">
                        ${link.label}
                    </a>
                `).join("")}
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
