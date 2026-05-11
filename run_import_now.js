/**
 * Run import and save output to file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputFile = path.join(__dirname, 'import_result.txt');

let output = '';
output += '='.repeat(60) + '\n';
output += 'بدء عملية الاستيراد...\n';
output += '='.repeat(60) + '\n\n';

try {
    // Step 1: Clear data
    output += '>> الخطوة 1: مسح البيانات القديمة...\n';
    try {
        const clearResult = execSync('node scripts/clearInventoryData.js', { 
            cwd: __dirname, 
            encoding: 'utf8',
            timeout: 30000
        });
        output += clearResult + '\n';
    } catch (e) {
        output += 'Clear error: ' + e.message + '\n';
    }
    
    // Step 2: Import data
    output += '\n>> الخطوة 2: استيراد البيانات الجديدة...\n';
    try {
        const importResult = execSync('node scripts/importInventoryData.js', { 
            cwd: __dirname, 
            encoding: 'utf8',
            timeout: 60000
        });
        output += importResult + '\n';
    } catch (e) {
        output += 'Import error: ' + e.message + '\n';
        output += 'Stderr: ' + e.stderr + '\n';
    }
    
    output += '\n' + '='.repeat(60) + '\n';
    output += 'تم الانتهاء!\n';
    output += '='.repeat(60) + '\n';
    
} catch (error) {
    output += '\n❌ خطأ عام: ' + error.message + '\n';
}

// Write output to file
fs.writeFileSync(outputFile, output, 'utf8');
console.log('Output saved to: ' + outputFile);
console.log(output);
