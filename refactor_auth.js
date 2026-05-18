const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('public/**/*.+(html|js)', { absolute: true });

let modifiedFiles = 0;

for (const file of files) {
    // Skip this script itself and common-functions.js
    if (file.endsWith('refactor_auth.js') || file.endsWith('common-functions.js')) continue;

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We can replace token retrieval
    // The problem is if getToken() is not defined. We can assume it is.
    content = content.replace(/localStorage\.getItem\(['"]token['"]\)/g, 'getToken()');
    
    // Replace user retrieval
    content = content.replace(/JSON\.parse\(localStorage\.getItem\(['"]user['"]\)\s*\|\|\s*['"]\{\}['"]\)/g, 'getUser()');
    content = content.replace(/localStorage\.getItem\(['"]user['"]\)/g, 'getUser()');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedFiles++;
        console.log(`Updated ${path.relative(__dirname, file)}`);
    }
}

console.log(`Modified ${modifiedFiles} files.`);
