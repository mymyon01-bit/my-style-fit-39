// ─── SSRF GUARD ────────────────────────────────────────────────────────────
// Resolves a caller-provided URL, rejects private/loopback/link-local/metadata
// hosts, and blocks non-http(s) protocols. Use before any server-side fetch()
// of a URL supplied by an untrusted caller.

const PRIVATE_V4_CIDRS: Array<[number, number]> = (() => {
  const cidrs: string[] = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16", // link-local + cloud metadata
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
    "255.255.255.255/32",
  ];
  return cidrs.map((c) => {
    const [ip, bitsStr] = c.split("/");
    const bits = parseInt(bitsStr, 10);
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    const num = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return [num & mask, mask] as [number, number];
  });
})();

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return PRIVATE_V4_CIDRS.some(([net, mask]) => (n & mask) === net);
}

function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fe80:") || s.startsWith("fc") || s.startsWith("fd")) return true;
  if (s.startsWith("::ffff:")) {
    const v4 = s.slice(7);
    return isPrivateV4(v4);
  }
  return false;
}

async function resolveHost(host: string): Promise<string[]> {
  // Deno.resolveDns is stable in the edge runtime.
  const out: string[] = [];
  const kinds: Array<"A" | "AAAA"> = ["A", "AAAA"];
  for (const k of kinds) {
    try {
      // deno-lint-ignore no-explicit-any
      const res = await (Deno as any).resolveDns(host, k);
      if (Array.isArray(res)) out.push(...res);
    } catch { /* ignore per-family failure */ }
  }
  return out;
}

export interface SsrfValidationOk {
  ok: true;
  url: URL;
}
export interface SsrfValidationErr {
  ok: false;
  reason:
    | "invalid_url"
    | "bad_protocol"
    | "private_host"
    | "dns_failed";
}

/**
 * Validate a URL is safe to fetch server-side.
 * - Requires http/https
 * - Rejects literal private/loopback/link-local IPs in host
 * - Resolves DNS and rejects if any returned address is private
 */
export async function assertSafeUrl(raw: string): Promise<SsrfValidationOk | SsrfValidationErr> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, reason: "invalid_url" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "bad_protocol" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Literal IPs first
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateV4(host)) return { ok: false, reason: "private_host" };
    return { ok: true, url };
  }
  if (host.includes(":")) {
    if (isPrivateV6(host)) return { ok: false, reason: "private_host" };
    return { ok: true, url };
  }
  // Hostname — resolve
  const addrs = await resolveHost(host);
  if (addrs.length === 0) return { ok: false, reason: "dns_failed" };
  for (const a of addrs) {
    if (a.includes(":")) {
      if (isPrivateV6(a)) return { ok: false, reason: "private_host" };
    } else if (isPrivateV4(a)) {
      return { ok: false, reason: "private_host" };
    }
  }
  return { ok: true, url };
}

/**
 * Extract auth user id from bearer token; returns null when absent/invalid.
 * Uses the anon client (no service role) to validate the JWT.
 */
export async function getCallerUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.id === "string" ? j.id : null;
  } catch {
    return null;
  }
}
