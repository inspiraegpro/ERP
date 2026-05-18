const fs = require('fs');
const path = require('path');

class FileDatabaseManager {
    constructor(basePath = './data_storage') {
        this.basePath = basePath;
    }

    // Ensure collection directory exists before writing
    ensureCollectionDir(collection) {
        const dirPath = path.join(this.basePath, collection);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return dirPath;
    }

    // Get file path for a collection
    getCollectionPath(collection) {
        return path.join(this.basePath, collection, 'index.json');
    }

    // Read all documents from a collection
    async find(collection, query = {}) {
        try {
            const filePath = this.getCollectionPath(collection);
            if (!fs.existsSync(filePath)) {
                return [];
            }

            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const cleanContent = fileContent.replace(/^\uFEFF/, '').trim();
                const data = JSON.parse(cleanContent || '{}');

                if (Object.keys(query).length === 0) {
                    return data;
                }

                // Simple query matching
                return data.filter(doc => {
                    return Object.keys(query).every(key => {
                        if (query[key] instanceof RegExp) {
                            return query[key].test(doc[key]);
                        }
                        return doc[key] === query[key];
                    });
                });
            } catch (parseError) {
                console.error(`Error parsing ${collection}:`, parseError);
                return [];
            }
        } catch (error) {
            console.error(`Error reading ${collection}:`, error);
            return [];
        }
    }

    // Find one document
    async findOne(collection, query) {
        const results = await this.find(collection, query);
        return results.length > 0 ? results[0] : null;
    }

    // Find by ID helper
    async findById(collection, id) {
        return await this.findOne(collection, { _id: id });
    }

    // Delete many documents
    async deleteMany(collection, query) {
        try {
            const filePath = this.getCollectionPath(collection);
            const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

            const initialCount = data.length;
            const filteredData = data.filter(doc => {
                return !Object.keys(query).every(key => {
                    if (query[key] && typeof query[key] === 'object' && query[key].$in) {
                        return query[key].$in.includes(doc[key]);
                    }
                    return doc[key] === query[key];
                });
            });

            fs.writeFileSync(filePath, JSON.stringify(filteredData, null, 2));
            return { deletedCount: initialCount - filteredData.length };
        } catch (error) {
            console.error(`Error deleteMany in ${collection}:`, error);
            throw error;
        }
    }

    // Create a new document
    async create(collection, document) {
        try {
            this.ensureCollectionDir(collection);
            const filePath = this.getCollectionPath(collection);
            const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]') : [];

            // لو الـ document جاي بـ _id فارغ أو null، نولّد ID جديد
            const docId = (document._id !== undefined && document._id !== null && document._id !== '')
                ? document._id
                : this.generateId();

            const newDoc = {
                ...document,
                _id: docId,          // ← الـ _id دايماً يكون صحيح
                createdAt: document.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            data.push(newDoc);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            return newDoc;
        } catch (error) {
            console.error(`Error creating in ${collection}:`, error);
            throw error;
        }
    }

    // Update a document
    async updateOne(collection, query, update) {
        try {
            this.ensureCollectionDir(collection);
            const filePath = this.getCollectionPath(collection);
            const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

            const index = data.findIndex(doc => {
                return Object.keys(query).every(key => doc[key] === query[key]);
            });

            if (index === -1) {
                return null;
            }

            data[index] = {
                ...data[index],
                ...update,
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return data[index];
        } catch (error) {
            console.error(`Error updating in ${collection}:`, error);
            throw error;
        }
    }

    // Delete a document
    async deleteOne(collection, query) {
        try {
            this.ensureCollectionDir(collection);
            const filePath = this.getCollectionPath(collection);
            const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

            const index = data.findIndex(doc => {
                return Object.keys(query).every(key => doc[key] === query[key]);
            });

            if (index === -1) {
                return false;
            }

            const deleted = data.splice(index, 1)[0];
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error deleting from ${collection}:`, error);
            throw error;
        }
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Update many documents
    async updateMany(collection, query, update) {
        try {
            const filePath = this.getCollectionPath(collection);
            let data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

            let modifiedCount = 0;
            const updatedData = data.map(doc => {
                const match = Object.keys(query).every(key => doc[key] === query[key]);
                if (match) {
                    modifiedCount++;
                    // Basic merge - does NOT support $inc/$set operators
                    return {
                        ...doc,
                        ...update,
                        updatedAt: new Date().toISOString()
                    };
                }
                return doc;
            });

            fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
            return { modifiedCount };
        } catch (error) {
            console.error(`Error updateMany in ${collection}:`, error);
            throw error;
        }
    }

    // Get count of documents
    async countDocuments(collection, query = {}) {
        const results = await this.find(collection, query);
        return results.length;
    }
}

module.exports = FileDatabaseManager;
