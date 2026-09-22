export const AUTH_COOKIE = "bm_auth";
export const SESSION_COOKIE = "bm_session";
export const REFRESH_COOKIE = "bm_refresh";

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

export function readRequestToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return readCookie(request, SESSION_COOKIE);
}

export function readRefreshToken(request: Request) {
  return readCookie(request, REFRESH_COOKIE);
}
