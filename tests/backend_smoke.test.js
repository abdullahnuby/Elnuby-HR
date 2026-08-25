const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverDir = path.join(root, 'src', 'server', 'hr');
const files = fs.readdirSync(serverDir).filter(f => f.endsWith('.ts'));

const expected = [
  'core.ts',
  'auth.ts',
  'dashboard.ts',
  'employees.ts',
  'projects.ts',
  'shifts.ts',
  'assignments.ts',
  'attendance.ts',
  'leaves.ts',
  'permissions.ts',
  'users.ts',
  'router.ts',
];

for (const file of expected) {
  if (!files.includes(file)) throw new Error(`Missing backend module: ${file}`);
}

const core = fs.readFileSync(path.join(serverDir, 'core.ts'), 'utf8');
const workforce = fs.readFileSync(path.join(serverDir, 'assignments.ts'), 'utf8');
const router = fs.readFileSync(path.join(serverDir, 'router.ts'), 'utf8');
const users = fs.readFileSync(path.join(serverDir, 'users.ts'), 'utf8');

if (!core.includes('.schema("hr")')) throw new Error('Business client is not pinned to hr schema');
if (!core.includes('SITE_SUPERVISOR')) throw new Error('Scope core missing SITE_SUPERVISOR');
if (!core.includes('project_supervisors')) throw new Error('Scope core missing project_supervisors');
if (!workforce.includes('listEmployeeShifts')) throw new Error('Workforce shift service missing');
if (!users.includes('project_supervisors')) throw new Error('SITE_SUPERVISOR provisioning missing');
if (!router.includes('case "employee_shifts"')) throw new Error('employee_shifts action missing');
if (!router.includes('case "deductions"')) throw new Error('deductions action missing');
if (!fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('.env*')) throw new Error('.env files are not ignored');

console.log('PASS backend smoke: modular backend, scope, user provisioning, actions, and repository hygiene checks passed.');
