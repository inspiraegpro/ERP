const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getAuditLogs, getAuditStats } = require('../middleware/auditLogger');
const BackupManager = require('../middleware/backupManager');

const backupManager = new BackupManager();

// Health Check - Must be before authentication for login page checking
router.get('/system/health', async (req, res) => {
    try {
        const FileDatabaseManager = require('../file_db_manager');
        const db = new FileDatabaseManager();

        // Test database connection (Optional, but good for detailed health)
        let dbStats = {};
        try {
            dbStats = {
                accounts: (await db.find('accounts')).length,
                products: (await db.find('products')).length,
                users: (await db.find('users')).length,
            };
        } catch (e) { console.error("Health check DB error:", e.message); }

        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbStats,
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };

        res.json({ success: true, data: health });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message, status: 'unhealthy' });
    }
});

// Apply authentication to all other admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// GET: Admin dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const auditStats = await getAuditStats();
        const backups = backupManager.listBackups();

        res.json({
            success: true,
            data: {
                audit: auditStats,
                backups: {
                    total: backups.length,
                    latest: backups[0] || null,
                    list: backups.slice(0, 5)
                },
                system: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    nodeVersion: process.version,
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET: Audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { userId, method, fromDate, toDate, page = 1, limit = 50 } = req.query;

        const filters = {};
        if (userId) filters.userId = userId;
        if (method) filters.method = method;
        if (fromDate && toDate) {
            filters.fromDate = fromDate;
            filters.toDate = toDate;
        }

        const logs = await getAuditLogs(filters);

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedLogs = logs.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: {
                logs: paginatedLogs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: logs.length,
                    pages: Math.ceil(logs.length / limit)
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET: Audit statistics
router.get('/audit-stats', async (req, res) => {
    try {
        const stats = await getAuditStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST: Create backup
router.post('/backup/create', async (req, res) => {
    try {
        const { name } = req.body;

        const backup = await backupManager.createBackup(name);

        res.json({
            success: true,
            message: 'Backup created successfully',
            data: backup
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST: Create instant snapshot backup
router.post('/backup/snapshot', async (req, res) => {
    try {
        const { name } = req.body;
        const backup = await backupManager.createSnapshot(name);

        res.json({
            success: true,
            message: 'Snapshot backup created successfully',
            data: backup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET: List backups
router.get('/backup/list', (req, res) => {
    try {
        const backups = backupManager.listBackups();

        res.json({
            success: true,
            data: backups
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST: Restore backup
router.post('/backup/restore', async (req, res) => {
    try {
        const { backupName } = req.body;

        if (!backupName) {
            return res.status(400).json({
                success: false,
                message: 'Backup name is required'
            });
        }

        const result = await backupManager.restoreBackup(backupName);

        res.json({
            success: true,
            message: 'Backup restored successfully',
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// DELETE: Delete backup
router.delete('/backup/:backupName', async (req, res) => {
    try {
        const { backupName } = req.params;
        const result = await backupManager.deleteBackup(backupName);
        res.json({
            success: true,
            message: 'Backup deleted successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST: System cleanup
router.post('/system/cleanup', async (req, res) => {
    try {
        const { options } = req.body;

        let cleanupResults = [];

        // Clean old audit logs (older than 30 days)
        if (options?.cleanOldLogs) {
            const { getAuditLogs } = require('../middleware/auditLogger');
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldLogs = await getAuditLogs({
                fromDate: new Date('2000-01-01'),
                toDate: thirtyDaysAgo
            });

            cleanupResults.push({
                action: 'cleanOldLogs',
                deleted: oldLogs.length,
                message: `Deleted ${oldLogs.length} old audit logs`
            });
        }

        // Clean old backups (older than 7 days)
        if (options?.cleanOldBackups) {
            const backups = backupManager.listBackups();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            let deletedBackups = 0;
            for (const backup of backups) {
                if (new Date(backup.created) < sevenDaysAgo) {
                    await backupManager.deleteBackup(backup.name);
                    deletedBackups++;
                }
            }

            cleanupResults.push({
                action: 'cleanOldBackups',
                deleted: deletedBackups,
                message: `Deleted ${deletedBackups} old backups`
            });
        }

        res.json({
            success: true,
            message: 'System cleanup completed',
            data: cleanupResults
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
