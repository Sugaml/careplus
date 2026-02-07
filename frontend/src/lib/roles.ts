/**
 * Role constants aligned with backend. Used for nav visibility and route guards.
 */
export const ROLE_ADMIN = 'admin';
export const ROLE_MANAGER = 'manager';
export const ROLE_PHARMACIST = 'pharmacist';
export const ROLE_STAFF = 'staff'; // end-user / buyer

/** Roles that see the full staff dashboard (product/order management, inventory, etc.). */
export const STAFF_DASHBOARD_ROLES: string[] = [ROLE_ADMIN, ROLE_MANAGER, ROLE_PHARMACIST];

/** All roles that can access the app dashboard (including buyer). */
export const DASHBOARD_ROLES: string[] = [...STAFF_DASHBOARD_ROLES, ROLE_STAFF];

/** Paths that end-users (role staff) are allowed to access. Others redirect to /dashboard. */
export const BUYER_ALLOWED_PATHS = ['/dashboard', '/catalog', '/orders', '/chat', '/profile'];

export function isStaffRole(role: string | undefined): boolean {
  return !!role && STAFF_DASHBOARD_ROLES.includes(role);
}

export function isBuyerRole(role: string | undefined): boolean {
  return role === ROLE_STAFF;
}

export function isBuyerAllowedPath(pathname: string): boolean {
  return BUYER_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
