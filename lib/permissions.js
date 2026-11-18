// Staff access is an allowlist. Routes and navigation use this same policy.
const staffRoutes = [
  { methods: ['GET', 'HEAD'], path: /^\/(?:dashboard)?$/ },
  { methods: ['GET', 'HEAD'], path: /^\/rooms\/?$/ },
  { methods: ['GET', 'HEAD'], path: /^\/readings\/?$/ },
  { methods: ['POST'], path: /^\/readings\/\d+\/?$/ },
  { methods: ['POST'], path: /^\/api\/readings\/?$/ },
  { methods: ['GET', 'HEAD'], path: /^\/api\/dashboard\/summary\/?$/ },
];

export function canAccess(role, path, method = 'GET') {
  if (role === 'admin') return true;
  return (
    role === 'staff' &&
    staffRoutes.some((route) => route.methods.includes(method) && route.path.test(path))
  );
}

export function navigationFor(role) {
  return [
    { href: '/dashboard', label: 'ภาพรวม', icon: 'dashboard' },
    { href: '/readings', label: 'จดมิเตอร์', icon: 'readings' },
    { href: '/bills', label: 'บิลประจำเดือน', icon: 'bills' },
    { href: '/payments', label: 'รับชำระเงิน', icon: 'payments' },
    { href: '/rooms', label: 'ห้องพัก', icon: 'rooms' },
    { href: '/tenants', label: 'ผู้เช่า', icon: 'tenants' },
    { href: '/announcements', label: 'ประกาศ', icon: 'announcements' },
    { href: '/reports', label: 'รายงาน', icon: 'reports' },
    { href: '/settings', label: 'ตั้งค่า', icon: 'settings', group: 'system' },
    { href: '/users', label: 'ผู้ใช้งานระบบ', icon: 'users', group: 'system' },
  ].filter((page) => canAccess(role, page.href));
}
