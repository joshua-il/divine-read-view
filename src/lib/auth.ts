import { ADMIN_EMAIL, type AdminSession } from "./types";

const SESSION_STORAGE_KEY = "nrim_admin_session";
const PASSWORD_STORAGE_KEY = "nrim_admin_password";

// Secure admin password requested by user
const ADMIN_PASSWORD = "Admin@NRIM26!";

export function getAdminPassword(): string {
  if (typeof window === "undefined") return ADMIN_PASSWORD;
  const saved = localStorage.getItem(PASSWORD_STORAGE_KEY);
  // Clear any legacy insecure default passwords from cache
  if (saved === "admin" || saved === "admin123" || saved === "nrim2026admin") {
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
    return ADMIN_PASSWORD;
  }
  return saved || ADMIN_PASSWORD;
}

export function setAdminPassword(newPassword: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
}

export function getStoredSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (Date.now() > session.expiresAt) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AdminSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem("nrim_admin");
}

export function isCurrentAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const session = getStoredSession();
  return Boolean(session && session.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

export function loginAdmin(
  email: string,
  password: string,
): { success: boolean; error?: string; session?: AdminSession } {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== ADMIN_EMAIL.toLowerCase()) {
    return {
      success: false,
      error: `Access denied. Admin privileges are restricted to ${ADMIN_EMAIL}.`,
    };
  }

  const currentPassword = getAdminPassword();
  const isValidPassword = password === currentPassword;

  if (!isValidPassword) {
    return {
      success: false,
      error: "Invalid password. Access denied.",
    };
  }

  // Create session valid for 7 days
  const session: AdminSession = {
    email: ADMIN_EMAIL,
    token: `nrim_admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  setStoredSession(session);

  return {
    success: true,
    session,
  };
}

export function logoutAdmin(): void {
  clearStoredSession();
}

export function changeAdminPassword(
  oldPassword: string,
  newPassword: string,
): { success: boolean; error?: string } {
  const currentPassword = getAdminPassword();
  const isValid = oldPassword === currentPassword;

  if (!isValid) {
    return { success: false, error: "Current password is incorrect." };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters long." };
  }

  setAdminPassword(newPassword);
  return { success: true };
}
