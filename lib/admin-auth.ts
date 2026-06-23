const STORAGE_KEY = "laggard-admin-secret";

export function loadAdminSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveAdminSecret(secret: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, secret);
}
