const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src', 'app', 'page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src', 'app', 'api', 'hr', 'route.ts'), 'utf8');
const router = fs.readFileSync(path.join(root, 'src', 'server', 'hr', 'router.ts'), 'utf8');
const componentsDir = path.join(root, 'src', 'components', 'hr');

const uiSources = [page, ...fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx')).map(f => fs.readFileSync(path.join(componentsDir, f), 'utf8'))];
const uiActions = uiSources.flatMap(source => [...source.matchAll(/api(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
const routeActions = [...router.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m => m[1]);
const missing = [...new Set(uiActions)].filter(a => !routeActions.includes(a));

if (missing.length) {
  throw new Error(`UI actions missing backend routes: ${missing.join(', ')}`);
}

const requiredComponents = [
  'Dashboard.tsx',
  'DashboardHome.tsx',
  'EmployeesPage.tsx',
  'ProjectsPage.tsx',
  'ShiftsPage.tsx',
  'LeaveSection.tsx',
  'PermissionSection.tsx',
  'UsersPage.tsx',
  'Reports.tsx',
  'Settings.tsx',
  'common.tsx',
  'constants.ts',
  'types.ts',
];
for (const file of requiredComponents) {
  if (!fs.existsSync(path.join(componentsDir, file))) {
    throw new Error(`Missing extracted frontend component: ${file}`);
  }
}

for (const required of ['employees', 'projects', 'shifts', 'employee_shifts', 'attendance_list', 'leave_list', 'permission_list', 'deductions']) {
  if (!routeActions.includes(required)) throw new Error(`Backend action missing: ${required}`);
}

if (!route.includes('@/server/hr/router')) throw new Error('API route is not using the modular router');
if (!route.includes('SESSION_COOKIE')) throw new Error('Secure session cookie is not wired');
const core = fs.readFileSync(path.join(root, 'src', 'server', 'hr', 'core.ts'), 'utf8');
if (!core.includes('SITE_SUPERVISOR')) throw new Error('SITE_SUPERVISOR is not represented in scope core');

console.log(`PASS contract: ${new Set(uiActions).size} UI actions map to modular backend routes.`);
