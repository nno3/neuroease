/**
 * Patient auth service – activate (invite link), request magic link, verify magic link.
 * All call apiRequest; activate and verifyMagicLink return { user, token } and caller stores via setStoredAuth.
 */
import { apiRequest, setStoredAuth, clearStoredAuth, getStoredAuth } from "./apiClient";

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

/** Backend sends magic link to email; patient opens link to log in (verifyMagicLink) */
export async function requestLoginLink(email) {
  const data = await apiRequest("/api/auth/patient/request-login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!data.success) throw new Error(data.message || "Failed to send login link");
  return data;
}

/** Validate magic link token; returns { user, token }. Caller should call setStoredAuth and login(). */
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

/** Log in with the 6-digit code from your email. Use this when you opened the app from your home screen and the link opened in Safari. */
export async function verifyCode(email, code) {
  const data = await apiRequest("/api/auth/patient/verify-code", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
  if (data.success && data.data?.user && data.data?.token) {
    setStoredAuth(data.data.user, data.data.token);
    return data.data;
  }
  throw new Error(data.message || "Invalid or expired code");
}

export function logout() {
  clearStoredAuth();
}

export function getAuth() {
  return getStoredAuth();
}
