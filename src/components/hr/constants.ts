export const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: 'مدير النظام',
  HR_MANAGER: 'مدير الموارد البشرية',
  PROJECT_MANAGER: 'مدير مشروع',
  SECTOR_MANAGER: 'مدير قطاع / مدير مشروعات',
  EMPLOYEE: 'موظف',
};

export const navByRole = (role: string) =>
  [
    { id: 'dashboard', label: 'لوحة التحكم', icon: '⌂' },
    { id: 'employees', label: 'الموظفون', icon: '♙', roles: ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER', ] },
    { id: 'projects', label: 'المشاريع', icon: '▦', roles: ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER', ] },
    { id: 'shifts', label: 'الورديات', icon: '◴', roles: ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER', ] },
    { id: 'attendance', label: 'الحضور والانصراف', icon: '◷' },
    { id: 'leaves', label: 'الإجازات', icon: '▤' },
    { id: 'permissions', label: 'الأذونات', icon: '◉' },
    { id: 'deductions', label: 'الخصومات', icon: '−', roles: ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER', ] },
    { id: 'users', label: 'حسابات المستخدمين', icon: '♙', roles: ['SYSTEM_ADMIN', 'HR_MANAGER'] },
    { id: 'reports', label: 'التقارير', icon: '▥', roles: ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER', ] },
    { id: 'settings', label: 'إعدادات النظام', icon: '⚙', roles: ['SYSTEM_ADMIN'] },
  ].filter((x) => !x.roles || x.roles.includes(role));
