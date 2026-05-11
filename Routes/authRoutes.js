const express = require('express');
const router = express.Router();
const { login, initializeDefaultUser } = require('../middleware/auth');

// Initialize default user on startup
initializeDefaultUser();

// POST: Login
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                message: 'Username and password are required' 
            });
        }
        
        const result = await login(username, password);
        
        res.json({
            success: true,
            message: 'Login successful',
            ...result
        });
        
    } catch (error) {
        res.status(401).json({ 
            success: false,
            message: error.message 
        });
    }
});

// POST: Logout (client-side only)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// GET: Current user info
router.get('/me', async (req, res) => {
    try {
        // This would require authentication middleware
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                message: 'No token provided' 
            });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inspera-secret-key');
        
        res.json({
            success: true,
            user: {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role
            }
        });
        
    } catch (error) {
        res.status(401).json({ 
            success: false,
            message: 'Invalid token' 
        });
    }
});

module.exports = router;
