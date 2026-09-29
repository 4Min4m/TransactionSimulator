import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setToken, getToken, clearToken } from "./auth";

// api.ts reads VITE_API_BASE_URL at import time, so stub it first.
vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/prod/");
const api = await import("./api");

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("api service", () => {
  beforeEach(() => clearToken());
  afterEach(() => vi.unstubAllGlobals());

  it("sends the bearer token and strips the trailing slash from the base URL", async () => {
    setToken("tok");
    const fetchMock = respond(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await api.getTransactions(10, 5);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/prod/api/transactions?limit=10&offset=5");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("clears an expired session on 401", async () => {
    setToken("expired");
    vi.stubGlobal("fetch", respond(401, { message: "Unauthorized" }));
    await expect(api.getTransactions()).rejects.toThrow(/sign in/);
    expect(getToken()).toBeNull();
  });

  it("surfaces the API error message on 409 (idempotency conflict)", async () => {
    setToken("tok");
    vi.stubGlobal("fetch", respond(409, { error: "order_id was already used with different transaction details" }));
    await expect(
      api.processTransaction({ merchant_id: "demo-merchant", order_id: "o1", amount: 1, card_number: "4111111111111111" })
    ).rejects.toThrow(/order_id was already used/);
  });
});
