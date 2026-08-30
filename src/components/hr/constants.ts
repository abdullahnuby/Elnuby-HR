export const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: 'مدير النظام',
  HR_MANAGER: 'مدير الموارد البشرية',
  PROJECT_MANAGER: 'مدير مشروع',
  SECTOR_MANAGER: 'مدير قطاع / مدير مشروعات',
  EMPLOYEE: 'موظف',
};

export const navByRole = (role: string) => [
  { id: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
  { id: 'employees', label: 'الموظفون', icon: 'users', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'projects', label: 'المشاريع', icon: 'projects', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'shifts', label: 'الورديات', icon: 'shifts', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'attendance', label: 'الحضور والانصراف', icon: 'attendance' },
  { id: 'attendance-calendar', label: 'تقويم الحضور', icon: 'calendar', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'leaves', label: 'الإجازات', icon: 'leaves' },
  { id: 'permissions', label: 'الأذونات', icon: 'permissions' },
  { id: 'deductions', label: 'الخصومات', icon: 'deductions', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'users', label: 'حسابات المستخدمين', icon: 'users', roles: ['SYSTEM_ADMIN','HR_MANAGER'] },
  { id: 'reports', label: 'التقارير', icon: 'reports', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'notifications', label: 'تنبيهات الموارد البشرية', icon: 'alert', roles: ['SYSTEM_ADMIN','HR_MANAGER'] },
  { id: 'approvals', label: 'مركز الاعتمادات', icon: 'check', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'performance', label: 'تقييم الأداء', icon: 'reports', roles: ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'] },
  { id: 'hr-advanced', label: 'إدارة الموارد البشرية المتقدمة', icon: 'settings', roles: ['SYSTEM_ADMIN','HR_MANAGER'] },
  { id: 'settings', label: 'إعدادات النظام', icon: 'settings', roles: ['SYSTEM_ADMIN','HR_MANAGER'] },
].filter(x => !x.roles || x.roles.includes(role));
