// 缓存预热
const fs = require('fs');
const path = require('path');

const CACHE_DIRS = [
    path.join(__dirname, '.cache', 'api'),
    path.join(__dirname, '.cache', 'links')
];

function warm() {
    CACHE_DIRS.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('Created cache: ' + dir);
        }
    });
    console.log('Cache directories ready');
}

warm();
