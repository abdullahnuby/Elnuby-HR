export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'مدير النظام',
  HR_MANAGER: 'مدير الموارد البشرية',
  PROJECT_MANAGER: 'مدير مشروع',
  PROJECT_DIRECTOR: 'مدير قطاع / مدير مشروعات',
  SITE_SUPERVISOR: 'مشرف موقع',
  EMPLOYEE: 'موظف',
};

export const navByRole = (role: string) =>
  [
    { id: 'dashboard', label: 'لوحة التحكم', icon: '⌂' },
    { id: 'employees', label: 'الموظفون', icon: '♙', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'SITE_SUPERVISOR'] },
    { id: 'projects', label: 'المشاريع', icon: '▦', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'SITE_SUPERVISOR'] },
    { id: 'shifts', label: 'الورديات', icon: '◴', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'SITE_SUPERVISOR'] },
    { id: 'attendance', label: 'الحضور والانصراف', icon: '◷' },
    { id: 'leaves', label: 'الإجازات', icon: '▤' },
    { id: 'permissions', label: 'الأذونات', icon: '◉' },
    { id: 'deductions', label: 'الخصومات', icon: '−', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'SITE_SUPERVISOR'] },
    { id: 'users', label: 'حسابات المستخدمين', icon: '♙', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
    { id: 'reports', label: 'التقارير', icon: '▥', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'SITE_SUPERVISOR'] },
    { id: 'settings', label: 'إعدادات النظام', icon: '⚙', roles: ['SUPER_ADMIN'] },
  ].filter((x) => !x.roles || x.roles.includes(role));
