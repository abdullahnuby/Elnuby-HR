const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'src/components/hr/AdminEditModal.tsx'), 'utf8');

for (const source of [page, modal]) {
  if (/window\.prompt\(/.test(source)) throw new Error('Admin edit UI must not use browser prompts');
}
for (const phrase of ['تعديل بيانات الموظف', 'تعديل بيانات المشروع', 'تعديل الوردية', 'تغيير كلمة مرور الحساب', 'حفظ التعديلات']) {
  if (!modal.includes(phrase)) throw new Error(`Missing Arabic admin editor label: ${phrase}`);
}
if (!page.includes('AdminEditModal')) throw new Error('AdminEditModal is not mounted in the application');
if (!page.includes("setAdminEdit({entity:'shift'")) throw new Error('Shift editor is not wired to modal');
if (!page.includes("setAdminEdit({entity:'project'")) throw new Error('Project editor is not wired to modal');
if (!page.includes("setAdminEdit({entity:'employee'")) throw new Error('Employee editor is not wired to modal');
console.log('PASS admin edit UI: dedicated Arabic modal editors for employees, projects, shifts, and account passwords; no browser prompts');
