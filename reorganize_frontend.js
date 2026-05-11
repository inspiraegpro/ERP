const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

const directories = {
    inventory: [
        'products.html', 'stock_in.html', 'stock_out.html', 'stock_report.html', 
        'warehouses.html', 'warehouse_dashboard.html', 'warehouse_verify.html', 
        'inventory_barcodes.html', 'inventory_label.html', 'inventory_reports.html', 
        'inventory_status.html', 'rolls_status.html', 'roll_status.html', 
        'stock.html', 'stock_analysis.html', 'stock_balance_tree.html', 
        'stock_inventory_report.html', 'stock_print.html', 'stock_transfer.html', 
        'stock_verification.html', 'cutting_planner.html', 'import_list.html', 
        'import_shipment.html', 'waste_report.html'
    ],
    sales: [
        'customers.html', 'sales_invoice.html', 'sales_list.html', 'sales_agents.html', 
        'invoice_print.html', 'job_order_print.html', 'customers_balance.html', 
        'customer_statement.html', 'sales.html', 'sales_analysis.html', 
        'sales_association.html', 'sales_invoice_details.html', 'sales_report.html'
    ],
    purchases: [
        'purchases.html', 'suppliers.html', 'purchase_invoice.html', 'general_purchase.html', 
        'purchase_invoice_details.html', 'purchase_list.html', 'suppliers_balance.html', 
        'supplier_coding.html', 'supplier_report.html'
    ],
    financial: [
        'accounts.html', 'journal.html', 'treasury.html', 'cost_centers.html', 
        'payment_receipt.html', 'financial_reports.html', 'treasury_print.html', 
        'treasury_report.html', 'treasury_statement.html', 'manual_entry.html'
    ],
    hr: [
        'hr.html', 'payroll.html', 'employees_list.html', 'payslip.html', 
        'employee_coding.html', 'payroll_analysis.html', 'payroll_management.html', 
        'technicians.html'
    ],
    service: [
        'cars.html', 'service_jobs.html', 'job_profitability.html', 'car_coding.html'
    ],
    admin: [
        'admin_dashboard.html', 'settings.html', 'audit_logs.html', 'data_management.html', 
        'reset_system.html', 'file_manager.html'
    ],
    reports: [
        'reports.html', 'smart_reports.html', 'price_list.html'
    ]
};

const keepInRoot = ['index.html', 'login.html'];
const assets = ['improved-styles.css', 'global-navigation.js', 'common-functions.js'];

// Build reverse map
const reverseMap = {};
for (const [folder, files] of Object.entries(directories)) {
    for (const file of files) {
        reverseMap[file] = `/${folder}/${file}`;
    }
}
for (const file of keepInRoot) {
    reverseMap[file] = `/${file}`;
}

function updateLinksInContent(content, filePath) {
    let newContent = content;

    // Update assets paths to absolute
    for (const asset of assets) {
        // Match string literals that are just the asset name, optionally with query params, not preceded by /
        const regexStr = `(?<!/)(["'\`])(${asset})(.*?)(\\1)`;
        const regex = new RegExp(regexStr, 'g');
        newContent = newContent.replace(regex, `$1/$2$3$4`);
    }

    // Update HTML links to absolute paths
    for (const [file, newPath] of Object.entries(reverseMap)) {
        // match "file" or 'file' or `file` not preceded by /
        const regexStr = `(?<!/)(["'\`])(${file})(.*?)(\\1)`;
        const regex = new RegExp(regexStr, 'g');
        newContent = newContent.replace(regex, `$1${newPath}$3$4`);
    }

    return newContent;
}

// 1. Create directories
for (const dir of Object.keys(directories)) {
    const dirPath = path.join(publicDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        console.log(`Created directory: ${dir}`);
    }
}

// 2. Move files
for (const [folder, files] of Object.entries(directories)) {
    for (const file of files) {
        const oldPath = path.join(publicDir, file);
        const newPath = path.join(publicDir, folder, file);
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Moved ${file} to ${folder}/`);
        }
    }
}

// 3. Update links in all HTML and JS files
function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath);
        } else if (file.endsWith('.html') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const updated = updateLinksInContent(content, filePath);
            if (content !== updated) {
                fs.writeFileSync(filePath, updated, 'utf8');
                console.log(`Updated links in ${filePath.replace(publicDir, '')}`);
            }
        }
    }
}

walk(publicDir);
console.log('Reorganization complete.');
