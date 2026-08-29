const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'page.tsx'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(page.includes('const [authReady, setAuthReady] = useState(false);'), 'authReady state missing');
expect(page.includes('if (!authReady) {'), 'initial auth loading guard missing');
expect(page.includes('if (!me) {'), 'final unauthenticated login guard missing');
expect(page.indexOf('if (!authReady) {') < page.indexOf('if (!me) {'), 'login guard must run after auth bootstrap guard');
expect(page.includes('if (!cancelled) setAuthReady(true);'), 'authReady must be finalized after bootstrap');
expect(page.includes('if (!navigator.onLine && await restoreCachedOfflineSession()) {'), 'offline bootstrap guard missing');
expect(!page.includes("window.location.replace('/login')"), 'unexpected login redirect found');

const loginFormIndex = page.indexOf("<h1>مرحباً بك</h1>");
const finalUnauthIndex = page.indexOf('if (!me) {');
expect(loginFormIndex > finalUnauthIndex, 'login form must only render after auth is resolved');

console.log('PASS auth refresh UI regression');
