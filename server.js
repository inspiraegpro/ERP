require('dotenv').config();
const express = require('express');
const FileDatabaseManager = require('./file_db_manager');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');
const { initializeDefaultUser } = require('./middleware/auth');
const BackupManager = require('./middleware/backupManager');

const app = express();
const PORT = process.env.PORT || 13620; 

// Initialize Local Database
const db = new FileDatabaseManager();
console.log('✅ Local File Database Initialized'); 

// Initialize Models with Database
const Product = require('./models/Product');
Product.setDb(db);
console.log('✅ Product Model Initialized');

// Initialize default user
initializeDefaultUser();

// Initialize backup manager
const backupManager = new BackupManager();
backupManager.scheduleAutoBackup(24); // Auto backup every 24 hours

// --- Server Settings ---
// Security: Restrict CORS in production (Update origin as needed)
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limit body size to prevent DoS, but allow for reasonable file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logger
app.use((req, res, next) => {
    console.log(`\n🔔 [${new Date().toLocaleTimeString()}] Request Received`);
    console.log(`➡️  ${req.method} ${req.url}`);
    next(); 
});

// Audit Logger (logs all API calls)
app.use('/api', auditLogger);

// --- Database Connection ---
// Using Local File Database - No external connection needed
console.log('✅ Local File Database Ready');

// --- Routes --- (MUST be before static middleware)
const useRoute = (path, file) => {
    try {
        app.use(path, require(file));
    } catch (e) {
        console.error(`⚠️ Failed to load route ${file}:`, e.message);
    }
};

// Route Mapping Object to reduce repetition
const routes = {
    '/api/auth': './Routes/authRoutes',
    '/api/products': './Routes/productRoutes',
    '/api/customers': './Routes/customerRoutes',
    '/api/suppliers': './Routes/supplierRoutes',
    // '/api/warehouses': './Routes/warehouseRoutes', // merged into /api/stock
    '/api/stock': './Routes/stockRoutes',
    '/api/accounts': './Routes/accountRoutes',
    '/api/purchases': './Routes/purchaseRoutes',
    '/api/sales': './Routes/salesRoutes',
    '/api/hr': './Routes/hrRoutes',           // تأكد أن هذا الملف يحتوي على POST/PUT/DELETE
    '/api/treasury': './Routes/treasuryRoutes',
    '/api/financial-settings': './Routes/financialSettingsRoutes', // New: Financial Settings Route
    '/api/cars': './Routes/carRoutes',
    '/api/reports': './Routes/reportRoutes',
    '/api/service-jobs': './Routes/serviceJobRoutes',
    '/api/service-adjustments': './Routes/serviceAdjustmentRoutes',
    '/api/warranty-requests': './Routes/warrantyRequestRoutes',
    '/api/reissue-requests': './Routes/reissueRequestRoutes',
    // '/api/inventory': './Routes/inventoryRoutes',
    '/api/journal': './Routes/journalRoutes',
    // '/api/pricing': './Routes/pricingRoutes',
    '/api/agents': './Routes/agentRoutes',      // ← وكلاء البيع
    '/api/data': './Routes/dataRoutes',         // ← استيراد وتصدير الإكسيل
    '/api/payment': './Routes/paymentRoutes',
    '/api/import-shipments': './Routes/importRoutes',
    '/api/accounting-mappings': './Routes/accountingMappingRoutes'
};

Object.entries(routes).forEach(([path, file]) => useRoute(path, file));
useRoute('/api/pricing', './Routes/pricingRoutes');

// Admin / System Routes
useRoute('/api/admin', './Routes/adminRoutes');

// API 404 Handler - MUST be before static middleware
app.use('/api', (req, res, next) => {
    // If we reach here, no API route matched
    if (req.path.startsWith('/')) {
        return res.status(404).json({ message: 'API endpoint not found', path: req.path });
    }
    next();
});

// Serve only the public directory for security (AFTER all API routes)
app.use(express.static('public'));

// Frontend Entry Point
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling (Must be last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on: http://localhost:${PORT}`);
    console.log(`👀 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
