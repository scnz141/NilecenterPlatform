import crypto from "node:crypto";
import net from "node:net";

type NileFormsRequestLike = {
  headers: { cookie?: string };
  ip?: string;
  socket?: { remoteAddress?: string };
  get(name: string): string | undefined;
};

type HmacKey = { version: number; key: Buffer };

export type NileFormsPublicHmacKeyring = {
  active: HmacKey;
  previous?: HmacKey;
};

export class NileFormsRequestSecurityError extends Error {
  constructor(
    message: string,
    readonly statusCode: 403 | 503,
    readonly code: string
  ) {
    super(message);
    this.name = "NileFormsRequestSecurityError";
  }
}

const localEphemeralHmacKey = crypto.randomBytes(32);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function decodeKey(value: string) {
  if (/^[0-9a-f]{64,}$/i.test(value) && value.length % 2 === 0) {
    return Buffer.from(value, "hex");
  }
  return Buffer.from(value, "base64");
}

function positiveVersion(value: unknown, fallback?: number) {
  const version = Number(value);
  if (Number.isInteger(version) && version > 0) return version;
  if (fallback !== undefined) return fallback;
  throw new NileFormsRequestSecurityError(
    "Nile Forms public HMAC key version is invalid.",
    503,
    "forms_public_hmac_config_invalid"
  );
}

function configuredHmacKey(
  value: unknown,
  version: unknown,
  label: string
): HmacKey | undefined {
  const encoded = clean(value);
  if (!encoded) return undefined;
  const key = decodeKey(encoded);
  if (key.length < 32) {
    throw new NileFormsRequestSecurityError(
      `${label} must contain at least 32 bytes.`,
      503,
      "forms_public_hmac_config_invalid"
    );
  }
  return { version: positiveVersion(version), key };
}

export function resolveNileFormsPublicHmacKeyring(
  env: NodeJS.ProcessEnv = process.env
): NileFormsPublicHmacKeyring {
  const active = configuredHmacKey(
    env.NILE_FORMS_PUBLIC_HMAC_KEY,
    env.NILE_FORMS_PUBLIC_HMAC_KEY_VERSION,
    "NILE_FORMS_PUBLIC_HMAC_KEY"
  );
  if (!active) {
    if (env.NODE_ENV === "production") {
      throw new NileFormsRequestSecurityError(
        "Nile Forms public HMAC configuration is unavailable.",
        503,
        "forms_public_hmac_config_missing"
      );
    }
    return {
      active: { version: 1, key: localEphemeralHmacKey },
    };
  }
  const previous = configuredHmacKey(
    env.NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY,
    env.NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY_VERSION,
    "NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY"
  );
  if (previous?.version === active.version) {
    throw new NileFormsRequestSecurityError(
      "Active and previous public HMAC keys require distinct versions.",
      503,
      "forms_public_hmac_config_invalid"
    );
  }
  return { active, previous };
}

function normalizeAddress(value: unknown) {
  let address = clean(value).replace(/^\[|\]$/g, "");
  const zoneIndex = address.indexOf("%");
  if (zoneIndex >= 0) address = address.slice(0, zoneIndex);
  if (address.startsWith("::ffff:") && net.isIP(address.slice(7)) === 4) {
    address = address.slice(7);
  }
  return net.isIP(address) ? address.toLowerCase() : "";
}

function ipv4Bytes(address: string) {
  return address.split(".").map(part => Number(part));
}

function ipv6Bytes(address: string) {
  let input = address;
  const ipv4Match = input.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const octets = ipv4Bytes(ipv4Match[1]);
    const tail = `${((octets[0] << 8) | octets[1]).toString(16)}:${(
      (octets[2] << 8) |
      octets[3]
    ).toString(16)}`;
    input = input.slice(0, -ipv4Match[1].length) + tail;
  }
  const halves = input.split("::");
  if (halves.length > 2) return [];
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return [];
  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (groups.length !== 8) return [];
  const bytes: number[] = [];
  for (const group of groups) {
    const value = Number.parseInt(group || "0", 16);
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) return [];
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}

function addressBytes(address: string) {
  const version = net.isIP(address);
  if (version === 4) return ipv4Bytes(address);
  if (version === 6) return ipv6Bytes(address);
  return [];
}

function addressInCidr(address: string, cidr: string) {
  const [networkValue, prefixValue] = cidr.split("/");
  const networkAddress = normalizeAddress(networkValue);
  const addressVersion = net.isIP(address);
  if (!networkAddress || net.isIP(networkAddress) !== addressVersion) {
    return false;
  }
  const bitLength = addressVersion === 4 ? 32 : 128;
  const prefix = prefixValue === undefined ? bitLength : Number(prefixValue);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bitLength) {
    return false;
  }
  const left = addressBytes(address);
  const right = addressBytes(networkAddress);
  for (let bit = 0; bit < prefix; bit += 1) {
    const mask = 1 << (7 - (bit % 8));
    if (
      (left[Math.floor(bit / 8)] & mask) !==
      (right[Math.floor(bit / 8)] & mask)
    ) {
      return false;
    }
  }
  return true;
}

function trustedProxyCidrs(env: NodeJS.ProcessEnv) {
  return clean(env.NILE_FORMS_TRUSTED_PROXY_CIDRS)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function isTrustedProxy(address: string, cidrs: string[]) {
  return cidrs.some(cidr => addressInCidr(address, cidr));
}

export function canonicalNileFormsClientAddress(
  req: NileFormsRequestLike,
  env: NodeJS.ProcessEnv = process.env
) {
  const socketAddress = normalizeAddress(req.socket?.remoteAddress ?? req.ip);
  if (!socketAddress) {
    throw new NileFormsRequestSecurityError(
      "Nile Forms could not establish a canonical client address.",
      503,
      "forms_client_address_unavailable"
    );
  }
  const cidrs = trustedProxyCidrs(env);
  const maxHops = Number(env.NILE_FORMS_TRUSTED_PROXY_HOPS);
  if (
    cidrs.length === 0 ||
    !Number.isInteger(maxHops) ||
    maxHops < 1 ||
    !isTrustedProxy(socketAddress, cidrs)
  ) {
    return socketAddress;
  }
  const forwarded = clean(req.get("x-forwarded-for"))
    .split(",")
    .map(normalizeAddress)
    .filter(Boolean);
  let candidate = socketAddress;
  let consumed = 0;
  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    if (consumed >= maxHops || !isTrustedProxy(candidate, cidrs)) break;
    candidate = forwarded[index];
    consumed += 1;
  }
  return candidate;
}

function hmacHex(key: Buffer, value: crypto.BinaryLike) {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

export function nileFormsPublicClientEvidence(
  req: NileFormsRequestLike,
  env: NodeJS.ProcessEnv = process.env,
  keyring = resolveNileFormsPublicHmacKeyring(env)
) {
  const address = canonicalNileFormsClientAddress(req, env);
  const addressIdentity = Buffer.from([
    net.isIP(address),
    ...addressBytes(address),
  ]);
  const userAgentHash = crypto
    .createHash("sha256")
    .update(clean(req.get("user-agent")), "utf8")
    .digest("hex");
  return {
    active: {
      ipHmac: hmacHex(keyring.active.key, addressIdentity),
      ipKeyVersion: keyring.active.version,
      userAgentHash,
      evidenceKeyVersion: keyring.active.version,
    },
    previous: keyring.previous
      ? {
          ipHmac: hmacHex(keyring.previous.key, addressIdentity),
          ipKeyVersion: keyring.previous.version,
        }
      : undefined,
  };
}

export function nileFormsPublicRequestHmac(
  operation: string,
  payload: Record<string, unknown>,
  keyring: NileFormsPublicHmacKeyring
) {
  const canonical = canonicalJson({ operation, ...payload });
  return {
    value: hmacHex(keyring.active.key, canonical),
    keyVersion: keyring.active.version,
  };
}

function allowedOrigins(req: NileFormsRequestLike, env: NodeJS.ProcessEnv) {
  const configured = clean(env.NILE_FORMS_ALLOWED_ORIGINS)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      try {
        return new URL(value).origin;
      } catch {
        throw new NileFormsRequestSecurityError(
          "Nile Forms allowed-origin configuration is invalid.",
          503,
          "forms_origin_config_invalid"
        );
      }
    });
  if (configured.length > 0) return new Set(configured);
  if (env.NODE_ENV === "production") return new Set<string>();
  const host = clean(req.get("host"));
  return new Set([`http://${host}`, `https://${host}`]);
}

export function requireNileFormsMutationRequest(
  req: NileFormsRequestLike,
  env: NodeJS.ProcessEnv = process.env
) {
  if (!clean(req.headers.cookie)) return;
  if (req.get("X-Nile-Learn-Request") !== "browser") {
    throw new NileFormsRequestSecurityError(
      "Missing first-party request header.",
      403,
      "forms_first_party_header_required"
    );
  }
  const host = clean(req.get("host")).toLowerCase();
  const originValue = clean(req.get("origin"));
  let origin: URL;
  try {
    origin = new URL(originValue);
  } catch {
    throw new NileFormsRequestSecurityError(
      "A valid request origin is required.",
      403,
      "forms_origin_denied"
    );
  }
  if (
    !host ||
    origin.host.toLowerCase() !== host ||
    !allowedOrigins(req, env).has(origin.origin)
  ) {
    throw new NileFormsRequestSecurityError(
      "Request origin is not allowed.",
      403,
      "forms_origin_denied"
    );
  }
  if (
    req.get("sec-fetch-site") !== "same-origin" ||
    !["cors", "same-origin"].includes(req.get("sec-fetch-mode") ?? "") ||
    req.get("sec-fetch-dest") !== "empty"
  ) {
    throw new NileFormsRequestSecurityError(
      "Request Fetch Metadata is not allowed.",
      403,
      "forms_fetch_metadata_denied"
    );
  }
}
