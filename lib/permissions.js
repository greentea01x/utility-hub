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
    { href: '/rooms', label: 'ห้องพัก' },
    { href: '/readings', label: 'จดมิเตอร์' },
    { href: '/bills', label: 'บิลรายเดือน' },
    { href: '/reports/arrears', label: 'รายงานลูกหนี้' },
  ].filter((page) => canAccess(role, page.href));
}
