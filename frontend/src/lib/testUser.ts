/**
 * Test user credentials for quick login (demo).
 * Must match backend seed: run `go run ./cmd/seed` in backend to create these users.
 */
const SEED_PASSWORD = 'password123';

export const TEST_USER_EMAIL = 'test@careplus.com';
export const TEST_USER_PASSWORD = SEED_PASSWORD;

/** Quick-login entries for each role (same password for all). */
export const QUICK_LOGIN_USERS = [
  { email: 'admin@careplus.com', password: SEED_PASSWORD, label: 'Admin', role: 'admin' },
  { email: 'manager@careplus.com', password: SEED_PASSWORD, label: 'Manager', role: 'manager' },
  { email: 'pharmacist@careplus.com', password: SEED_PASSWORD, label: 'Pharmacist', role: 'pharmacist' },
  { email: 'buyer@careplus.com', password: SEED_PASSWORD, label: 'End user (Buyer)', role: 'staff' },
] as const;
