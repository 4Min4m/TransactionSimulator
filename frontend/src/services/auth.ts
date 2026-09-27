// Minimal client-side auth helper.
//
// The JWT is stored in localStorage so the session survives a page refresh.
// Trade-off: localStorage is readable by JavaScript, so it is vulnerable to XSS.
// For this project that is acceptable; a hardened setup would use an httpOnly,
// SameSite cookie set by the API instead. The server (API Gateway authorizer)
// is the real enforcement point — these helpers only drive the UI.

const TOKEN_KEY = "ts_auth_token";

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Decode the JWT payload (no signature check — that is the server's job).
const decodePayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// True only if a token exists AND has not expired.
export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;
  const payload = decodePayload(token);
  if (!payload || !payload.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowSeconds;
};
