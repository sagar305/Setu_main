import { afterEach, describe, expect, it, vi } from "vitest";

// googleSession.ts is server-only; the marker throws outside a server bundle.
vi.mock("server-only", () => ({}));

import {
  SCOPES,
  authorizeUrl,
  hasRequiredScopes,
  pkcePair,
  resultPage,
  safeReturnPath,
  sameOrigin,
  seal,
  sessionConfig,
  unseal,
} from "@/lib/pos/drive/googleSession";

const env = {
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret-value",
  POS_TOKEN_COOKIE_KEY: "a-long-random-key-for-tests-0123456789",
} as unknown as NodeJS.ProcessEnv;

describe("configuration", () => {
  it("needs the client id, secret and cookie key", () => {
    expect(sessionConfig(env)).not.toBeNull();
    expect(sessionConfig({ ...env, GOOGLE_CLIENT_SECRET: "" })).toBeNull();
    expect(sessionConfig({ ...env, POS_TOKEN_COOKIE_KEY: "short" })).toBeNull();
  });

  it("tolerates quotes and spaces pasted into Vercel", () => {
    const cfg = sessionConfig({ ...env, GOOGLE_CLIENT_SECRET: '  "secret-value" ' });
    expect(cfg?.clientSecret).toBe("secret-value");
  });
});

describe("encrypted cookie", () => {
  const key = sessionConfig(env)!.key;

  it("round-trips", () => {
    expect(unseal(key, seal(key, { rt: "refresh-token", at: "now" }))).toEqual({ rt: "refresh-token", at: "now" });
  });

  it("can't be read or forged without the key", () => {
    const sealed = seal(key, { rt: "refresh-token" });
    expect(sealed).not.toContain("refresh-token");
    const otherKey = sessionConfig({ ...env, POS_TOKEN_COOKIE_KEY: "another-long-random-key-0123456789" })!.key;
    expect(unseal(otherKey, sealed)).toBeNull();
    const tampered = sealed.slice(0, -4) + (sealed.endsWith("A") ? "BBBB" : "AAAA");
    expect(unseal(key, tampered)).toBeNull();
    expect(unseal(key, "not-a-cookie")).toBeNull();
    expect(unseal(key, undefined)).toBeNull();
  });
});

describe("request checks", () => {
  const post = (origin: string | null) =>
    new Request("https://setutechnology.com/api/pos-google/token", {
      method: "POST",
      headers: origin ? { origin } : {},
    });

  it("only accepts POSTs from this same site", () => {
    expect(sameOrigin(post("https://setutechnology.com"))).toBe(true);
    expect(sameOrigin(post("https://evil.example"))).toBe(false);
    expect(sameOrigin(post(null))).toBe(false);
  });

  it("only returns to paths on this site after a full-page sign-in", () => {
    expect(safeReturnPath("/products/browser-based-pos?join=x")).toBe("/products/browser-based-pos?join=x");
    expect(safeReturnPath("https://evil.example")).toBe("/products/browser-based-pos");
    expect(safeReturnPath("//evil.example")).toBe("/products/browser-based-pos");
    expect(safeReturnPath(null)).toBe("/products/browser-based-pos");
  });
});

describe("Google sign-in request", () => {
  it("asks for offline access with consent, PKCE and both Drive scopes", () => {
    const { challenge, verifier } = pkcePair();
    expect(verifier).not.toBe(challenge);
    const url = new URL(
      authorizeUrl({ clientId: "cid", redirectUri: "https://x/api/pos-google/callback", state: "st", challenge, loginHint: "a@b.c" }),
    );
    const p = url.searchParams;
    expect(url.origin).toBe("https://accounts.google.com");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toContain("consent");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("login_hint")).toBe("a@b.c");
    expect(p.get("scope")).toBe(SCOPES.join(" "));
  });

  it("insists both Drive permissions were ticked", () => {
    expect(hasRequiredScopes(SCOPES.join(" "))).toBe(true);
    expect(hasRequiredScopes("openid email https://www.googleapis.com/auth/drive.file")).toBe(false);
    expect(hasRequiredScopes(undefined)).toBe(false);
  });

  it("result page can't be used to inject script", () => {
    const html = resultPage({ nonce: '</script><script>alert(1)</script>', ok: false, error: '"><img>', popup: true, returnTo: "/" });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).not.toContain('"><img>');
    // Only one closing script tag: the page's own.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("accepts only plain sign-in window ids", async () => {
    const { cleanNonce } = await import("@/lib/pos/drive/googleSession");
    expect(cleanNonce("abc123XYZ")).toBe("abc123XYZ");
    expect(cleanNonce("<script>")).toBe("");
    expect(cleanNonce(null)).toBe("");
  });
});

describe("token route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function callToken(cookie: string | null, google?: (body: URLSearchParams) => Response) {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
    if (google) {
      vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => google(new URLSearchParams(String(init.body))));
    }
    const { POST } = await import("@/app/api/pos-google/token/route");
    const { NextRequest } = await import("next/server");
    const headers: Record<string, string> = { origin: "https://setutechnology.com" };
    if (cookie) headers.cookie = `setu_pos_g=${cookie}`;
    return POST(new NextRequest("https://setutechnology.com/api/pos-google/token", { method: "POST", headers }));
  }

  it("says sign-in is needed when this device has no session", async () => {
    const res = await callToken(null);
    expect(res.status).toBe(401);
  });

  it("returns a fresh key from the device's cookie", async () => {
    const key = sessionConfig(env)!.key;
    const res = await callToken(seal(key, { rt: "rt-1", at: "now" }), (body) => {
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("rt-1");
      return Response.json({ access_token: "fresh", expires_in: 3599, scope: SCOPES.join(" ") });
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ access_token: "fresh", expires_in: 3599 });
  });

  it("clears the cookie when Google says the sign-in was revoked or expired", async () => {
    const key = sessionConfig(env)!.key;
    const res = await callToken(seal(key, { rt: "old", at: "now" }), () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/setu_pos_g=;/);
  });
});
