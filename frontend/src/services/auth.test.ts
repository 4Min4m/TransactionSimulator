import { describe, it, expect, beforeEach } from "vitest";
import { setToken, getToken, clearToken, isAuthenticated } from "./auth";

// Build a fake JWT (header.payload.signature) with a given exp claim.
const makeToken = (expSeconds: number): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "admin", role: "admin", exp: expSeconds }));
  return `${header}.${payload}.signature`;
};

describe("auth service", () => {
  beforeEach(() => clearToken());

  it("stores and reads a token", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
  });

  it("clears a token", () => {
    setToken("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("isAuthenticated is false with no token", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("isAuthenticated is true for a non-expired token", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    setToken(makeToken(future));
    expect(isAuthenticated()).toBe(true);
  });

  it("isAuthenticated is false for an expired token", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    setToken(makeToken(past));
    expect(isAuthenticated()).toBe(false);
  });

  it("isAuthenticated is false for a malformed token", () => {
    setToken("not-a-jwt");
    expect(isAuthenticated()).toBe(false);
  });
});
