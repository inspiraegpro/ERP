const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

// Audit logger middleware
const auditLogger = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log the request and response
        logAudit(req, res, data);
        originalSend.call(this, data);
    };
    
    next();
};

// Log audit trail
const logAudit = async (req, res, responseData) => {
    try {
        let resolvedUser = req.user;
        if (!resolvedUser && req.headers['authorization']) {
            const token = req.headers['authorization'].split(' ')[1];
            if (token) {
                try {
                    resolvedUser = jwt.verify(token, process.env.JWT_SECRET || 'inspera-secret-key');
                } catch (e) {
                    resolvedUser = undefined;
                }
            }
        }

        const auditEntry = {
            id: generateAuditId(),
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            headers: {
                'user-agent': req.headers['user-agent'],
                'authorization': req.headers['authorization'] ? '[REDACTED]' : undefined
            },
            body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
            user: resolvedUser ? {
                id: resolvedUser.id,
                username: resolvedUser.username,
                role: resolvedUser.role
            } : undefined,
            response: {
                statusCode: res.statusCode,
                success: res.statusCode < 400
            },
            ip: req.ip || req.connection.remoteAddress
        };
        
        // Save to audit log
        await db.create('audit_logs', auditEntry);
        
        // Also log to console for development
        console.log(`🔍 AUDIT: ${req.method} ${req.url} - ${res.statusCode} - User: ${req.user?.username || 'Anonymous'}`);
        
    } catch (error) {
        console.error('Error logging audit:', error);
    }
};

// Generate unique audit ID
const generateAuditId = () => {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Sanitize body for logging (remove sensitive data)
const sanitizeBody = (body) => {
    if (!body) return undefined;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...body };
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    
    return sanitized;
};

// Get audit logs
const getAuditLogs = async (filters = {}) => {
    try {
        const logs = await db.find('audit_logs');
        
        let filteredLogs = logs;
        
        // Apply filters
        if (filters.userId) {
            filteredLogs = filteredLogs.filter(log => 
                log.user && log.user.id === filters.userId
            );
        }
        
        if (filters.method) {
            filteredLogs = filteredLogs.filter(log => 
                log.method === filters.method
            );
        }
        
        if (filters.fromDate && filters.toDate) {
            filteredLogs = filteredLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= new Date(filters.fromDate) && 
                       logDate <= new Date(filters.toDate);
            });
        }
        
        // Sort by timestamp descending
        filteredLogs.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        return filteredLogs;
        
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return [];
    }
};

// Get audit statistics
const getAuditStats = async () => {
    try {
        const logs = await db.find('audit_logs');
        
        const stats = {
            totalRequests: logs.length,
            successfulRequests: logs.filter(log => log.response.success).length,
            failedRequests: logs.filter(log => !log.response.success).length,
            uniqueUsers: new Set(logs.filter(log => log.user).map(log => log.user.username)).size,
            topEndpoints: getTopEndpoints(logs),
            recentActivity: logs.slice(0, 10)
        };
        
        return stats;
        
    } catch (error) {
        console.error('Error getting audit stats:', error);
        return {};
    }
};

// Get top endpoints
const getTopEndpoints = (logs) => {
    const endpointCounts = {};
    
    logs.forEach(log => {
        const endpoint = log.method + ' ' + log.url;
        endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    });
    
    return Object.entries(endpointCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }));
};

module.exports = {
    auditLogger,
    getAuditLogs,
    getAuditStats
};
