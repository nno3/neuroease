import { apiRequest, setStoredAuth, clearStoredAuth, getStoredAuth } from "./apiClient";

/**
 * Activate account with invite token (from email link). Returns { user, token }.
 */
export async function activate(token) {
  const data = await apiRequest("/api/auth/activate", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (data.success && data.data?.user && data.data?.token) {
    setStoredAuth(data.data.user, data.data.token);
    return data.data;
  }
  throw new Error(data.message || "Activation failed");
}

/**
 * Request magic link (email only). Sends email; does not return a session.
 */
export async function requestLoginLink(email) {
  const data = await apiRequest("/api/auth/patient/request-login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!data.success) throw new Error(data.message || "Failed to send login link");
  return data;
}

/**
 * Verify magic link token and log in. Returns { user, token }.
 */
export async function verifyMagicLink(token) {
  const data = await apiRequest("/api/auth/patient/verify-link", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (data.success && data.data?.user && data.data?.token) {
    setStoredAuth(data.data.user, data.data.token);
    return data.data;
  }
  throw new Error(data.message || "Login failed");
}

export function logout() {
  clearStoredAuth();
}

export function getAuth() {
  return getStoredAuth();
}
