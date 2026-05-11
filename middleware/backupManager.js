const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

// Backup manager
class BackupManager {
    constructor() {
        this.backupPath = './backups';
        this.dataPath = './data_storage';
        this.ensureBackupDirectory();
    }

    // Ensure backup directory exists
    ensureBackupDirectory() {
        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }
    }

    // Create backup
    async createBackup(name = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = name || `backup_${timestamp}`;
            const backupDir = path.join(this.backupPath, backupName);
            
            // Create backup directory
            fs.mkdirSync(backupDir, { recursive: true });
            
            // Copy data files
            await this.copyDirectory(this.dataPath, backupDir);
            
            // Create backup metadata
            const metadata = {
                name: backupName,
                timestamp: new Date().toISOString(),
                size: this.getDirectorySize(backupDir),
                files: this.getFileList(backupDir),
                version: '1.0.0'
            };
            
            fs.writeFileSync(
                path.join(backupDir, 'backup_metadata.json'),
                JSON.stringify(metadata, null, 2)
            );
            
            // Create zip file
            const zipPath = path.join(this.backupPath, `${backupName}.zip`);
            await this.createZip(backupDir, zipPath);
            
            // Remove temporary directory
            await this.removeDirectory(backupDir);
            
            console.log(`✅ Backup created: ${backupName}.zip`);
            
            return {
                success: true,
                name: backupName,
                path: zipPath,
                size: metadata.size,
                timestamp: metadata.timestamp
            };
            
        } catch (error) {
            console.error('Error creating backup:', error);
            throw error;
        }
    }

    // Create instant snapshot backup as a full directory copy
    async createSnapshot(name = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = name || `backup_${timestamp}`;
            const snapshotDir = path.join(this.backupPath, backupName);

            if (fs.existsSync(snapshotDir)) {
                throw new Error(`Backup already exists: ${backupName}`);
            }

            fs.mkdirSync(snapshotDir, { recursive: true });
            await this.copyDirectory(this.dataPath, snapshotDir);

            const metadata = {
                name: backupName,
                timestamp: new Date().toISOString(),
                size: this.getDirectorySize(snapshotDir),
                files: this.getFileList(snapshotDir),
                version: '1.0.0',
                type: 'snapshot'
            };

            fs.writeFileSync(
                path.join(snapshotDir, 'backup_metadata.json'),
                JSON.stringify(metadata, null, 2)
            );

            console.log(`Backup snapshot created: ${backupName}`);

            return {
                success: true,
                name: backupName,
                path: snapshotDir,
                size: metadata.size,
                timestamp: metadata.timestamp,
                type: metadata.type
            };
        } catch (error) {
            console.error('Error creating snapshot backup:', error);
            throw error;
        }
    }

    // Restore backup
    async restoreBackup(backupName) {
        try {
            const zipPath = path.join(this.backupPath, `${backupName}.zip`);
            
            if (!fs.existsSync(zipPath)) {
                throw new Error(`Backup file not found: ${backupName}.zip`);
            }
            
            // Create temporary directory for extraction
            const tempDir = path.join(this.backupPath, 'temp_restore');
            if (fs.existsSync(tempDir)) {
                await this.removeDirectory(tempDir);
            }
            fs.mkdirSync(tempDir, { recursive: true });
            
            // Extract zip file
            await this.extractZip(zipPath, tempDir);
            
            // Get the extracted backup directory
            const extractedDirs = fs.readdirSync(tempDir);
            const backupDir = path.join(tempDir, extractedDirs[0]);
            
            // Verify backup metadata
            const metadataPath = path.join(backupDir, 'backup_metadata.json');
            if (!fs.existsSync(metadataPath)) {
                throw new Error('Invalid backup file: missing metadata');
            }
            
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            
            // Create backup of current data before restore
            await this.createBackup(`pre_restore_${Date.now()}`);
            
            // Remove current data directory
            if (fs.existsSync(this.dataPath)) {
                await this.removeDirectory(this.dataPath);
            }
            
            // Restore data
            await this.copyDirectory(backupDir, this.dataPath);
            
            // Clean up
            await this.removeDirectory(tempDir);
            
            console.log(`✅ Backup restored: ${backupName}`);
            
            return {
                success: true,
                restoredFrom: backupName,
                metadata: metadata
            };
            
        } catch (error) {
            console.error('Error restoring backup:', error);
            throw error;
        }
    }

    // List backups
    listBackups() {
        try {
            const backups = [];
            const files = fs.readdirSync(this.backupPath);
            
            files.forEach(file => {
                const filePath = path.join(this.backupPath, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    const metadataPath = path.join(filePath, 'backup_metadata.json');
                    let metadata = null;

                    if (fs.existsSync(metadataPath)) {
                        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                    }

                    backups.push({
                        name: file,
                        file: file,
                        size: metadata?.size ?? this.getDirectorySize(filePath),
                        created: metadata?.timestamp ?? stats.birthtime.toISOString(),
                        modified: stats.mtime.toISOString(),
                        type: metadata?.type || 'snapshot'
                    });
                    return;
                }

                if (file.endsWith('.zip')) {
                    backups.push({
                        name: file.replace('.zip', ''),
                        file: file,
                        size: stats.size,
                        created: stats.birthtime.toISOString(),
                        modified: stats.mtime.toISOString(),
                        type: 'zip'
                    });
                }
            });
            
            // Sort by creation date descending
            backups.sort((a, b) => new Date(b.created) - new Date(a.created));
            
            return backups;
            
        } catch (error) {
            console.error('Error listing backups:', error);
            return [];
        }
    }

    // Delete backup
    async deleteBackup(backupName) {
        try {
            const zipPath = path.join(this.backupPath, `${backupName}.zip`);
            const snapshotPath = path.join(this.backupPath, backupName);

            if (fs.existsSync(snapshotPath) && fs.statSync(snapshotPath).isDirectory()) {
                await this.removeDirectory(snapshotPath);
            } else if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            } else {
                throw new Error(`Backup not found: ${backupName}`);
            }
            console.log(`✅ Backup deleted: ${backupName}`);
            
            return { success: true, deleted: backupName };
            
        } catch (error) {
            console.error('Error deleting backup:', error);
            throw error;
        }
    }

    // Schedule automatic backup
    scheduleAutoBackup(intervalHours = 24) {
        setInterval(async () => {
            try {
                await this.createBackup(`auto_${Date.now()}`);
                console.log('🔄 Automatic backup completed');
            } catch (error) {
                console.error('Error in automatic backup:', error);
            }
        }, intervalHours * 60 * 60 * 1000);
        
        console.log(`⏰ Automatic backup scheduled every ${intervalHours} hours`);
    }

    // Helper methods
    async copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    async removeDirectory(dir) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    getDirectorySize(dir) {
        let totalSize = 0;
        
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(filePath);
                } else {
                    totalSize += stats.size;
                }
            });
        }
        
        return totalSize;
    }

    getFileList(dir) {
        const files = [];
        
        if (fs.existsSync(dir)) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            entries.forEach(entry => {
                const filePath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    files.push(...this.getFileList(filePath));
                } else {
                    files.push(filePath);
                }
            });
        }
        
        return files;
    }

    async createZip(sourceDir, zipPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            output.on('close', resolve);
            archive.on('error', reject);
            
            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    async extractZip(zipPath, destDir) {
        // Simple extraction - in production, use a proper zip library
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
            exec(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, 
                (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }
}

module.exports = BackupManager;
