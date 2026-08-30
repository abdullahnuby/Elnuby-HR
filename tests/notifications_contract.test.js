const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
const router=read('src/server/hr/router.ts');
const notifications=read('src/server/hr/notifications.ts');
const constants=read('src/components/hr/constants.ts');
const page=read('src/app/page.tsx');
if(!router.includes('case "notifications"')) throw new Error('notifications action missing');
if(!notifications.includes('CONTRACT_EXPIRY') || !notifications.includes('PENDING_LEAVE') || !notifications.includes('PENDING_PERMISSION') || !notifications.includes('OPEN_CASE')) throw new Error('notification rules missing');
if(!constants.includes("id: 'notifications'")) throw new Error('notifications nav missing');
if(!page.includes("api('notifications')")) throw new Error('notifications UI loading missing');
if(!notifications.includes('DOCUMENT_EXPIRED') || !notifications.includes('DOCUMENT_EXPIRY')) throw new Error('document notifications missing');
console.log('notifications contract: PASS');
