const jwt = require('jsonwebtoken');
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

// Simple authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            message: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'inspera-secret-key', (err, user) => {
        if (err) {
            console.error(`🔒 Auth Error [403]: ${err.message} for URL: ${req.originalUrl}`);
            return res.status(403).json({
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Admin access required'
        });
    }
    next();
};

// Login function
const login = async (username, password) => {
    try {
        // Get users from file database
        const users = await db.find('users');

        // Find user by username
        const user = users.find(u => u.username === username);

        if (!user) {
            throw new Error('User not found');
        }

        // Simple password check (in production, use bcrypt)
        if (user.password !== password) {
            throw new Error('Invalid password');
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role || 'user'
            },
            process.env.JWT_SECRET || 'inspera-secret-key',
            { expiresIn: '7d' }
        );

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role || 'user'
            }
        };

    } catch (error) {
        throw error;
    }
};

// Initialize default admin user
const initializeDefaultUser = async () => {
    try {
        const users = await db.find('users');

        if (users.length === 0) {
            // Create default admin user
            const defaultUser = {
                id: 'admin-001',
                username: 'admin',
                password: 'admin123', // Change in production!
                name: 'Administrator',
                role: 'admin',
                email: 'admin@inspera.com',
                createdAt: new Date().toISOString(),
                isActive: true
            };

            await db.create('users', defaultUser);
            console.log('✅ Default admin user created');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            console.log('   ⚠️  Please change password in production!');
        }
    } catch (error) {
        console.error('Error initializing default user:', error);
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    login,
    initializeDefaultUser
};
