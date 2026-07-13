import { describe, expect, it } from "vitest";

import {
  canonicalNileFormsClientAddress,
  nileFormsPublicClientEvidence,
  nileFormsPublicRequestHmac,
  NileFormsRequestSecurityError,
  requireNileFormsMutationRequest,
  resolveNileFormsPublicHmacKeyring,
} from "../../../../server/nileFormsRequestSecurity";

function request(
  headers: Record<string, string> = {},
  input: { cookie?: string; ip?: string; remoteAddress?: string } = {}
) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
  return {
    headers: { cookie: input.cookie },
    ip: input.ip,
    socket: { remoteAddress: input.remoteAddress },
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  };
}

const validBrowserHeaders = {
  host: "nilelearn.local:3061",
  origin: "http://nilelearn.local:3061",
  "x-nile-learn-request": "browser",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  "user-agent": "Nile Forms Test Agent",
};

describe("Phase 13F1 Nile Forms request security", () => {
  it("requires exact first-party origin, host, and Fetch Metadata for cookie mutations", () => {
    expect(() =>
      requireNileFormsMutationRequest(
        request(validBrowserHeaders, { cookie: "nilelearn_session=fake" }),
        { NODE_ENV: "test" }
      )
    ).not.toThrow();

    for (const headers of [
      { ...validBrowserHeaders, origin: "https://hostile.example" },
      {
        ...validBrowserHeaders,
        origin: "https://sibling.nilelearn.local:3061",
        "sec-fetch-site": "same-site",
      },
      { ...validBrowserHeaders, "x-nile-learn-request": "spoofed" },
      { ...validBrowserHeaders, "sec-fetch-site": "cross-site" },
      { ...validBrowserHeaders, "sec-fetch-dest": "document" },
    ]) {
      expect(() =>
        requireNileFormsMutationRequest(
          request(headers, { cookie: "nilelearn_session=fake" }),
          { NODE_ENV: "test" }
        )
      ).toThrow(NileFormsRequestSecurityError);
    }
  });

  it("does not apply cookie mutation checks to anonymous public requests", () => {
    expect(() =>
      requireNileFormsMutationRequest(
        request({ origin: "https://hostile.example" }),
        { NODE_ENV: "production" }
      )
    ).not.toThrow();
  });

  it("ignores spoofed forwarding headers unless the socket proxy is explicitly trusted", () => {
    const spoofed = request(
      { "x-forwarded-for": "203.0.113.99" },
      { remoteAddress: "198.51.100.4" }
    );
    expect(canonicalNileFormsClientAddress(spoofed, {})).toBe("198.51.100.4");

    const proxied = request(
      { "x-forwarded-for": "203.0.113.99, 10.0.0.8" },
      { remoteAddress: "10.0.0.9" }
    );
    expect(
      canonicalNileFormsClientAddress(proxied, {
        NILE_FORMS_TRUSTED_PROXY_CIDRS: "10.0.0.0/8",
        NILE_FORMS_TRUSTED_PROXY_HOPS: "2",
      })
    ).toBe("203.0.113.99");
  });

  it("stores only versioned HMAC evidence and supports active/previous rotation", () => {
    const env = {
      NODE_ENV: "test",
      NILE_FORMS_PUBLIC_HMAC_KEY: "11".repeat(32),
      NILE_FORMS_PUBLIC_HMAC_KEY_VERSION: "2",
      NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY: "22".repeat(32),
      NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY_VERSION: "1",
    };
    const keyring = resolveNileFormsPublicHmacKeyring(env);
    const evidence = nileFormsPublicClientEvidence(
      request(validBrowserHeaders, { remoteAddress: "203.0.113.10" }),
      env,
      keyring
    );

    expect(evidence.active.ipKeyVersion).toBe(2);
    expect(evidence.previous?.ipKeyVersion).toBe(1);
    expect(evidence.active.ipHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.previous?.ipHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(evidence)).not.toContain("203.0.113.10");

    const requestEvidence = nileFormsPublicRequestHmac(
      "forms.public.submit",
      {
        publicationId: "publication_1",
        versionId: "version_1",
        answers: { name: "Fake Applicant" },
        clientSubmissionId: "client-0001",
      },
      keyring
    );
    expect(requestEvidence.keyVersion).toBe(2);
    expect(requestEvidence.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalizes equivalent IPv6 spellings before deriving client evidence", () => {
    const env = {
      NODE_ENV: "test",
      NILE_FORMS_PUBLIC_HMAC_KEY: "11".repeat(32),
      NILE_FORMS_PUBLIC_HMAC_KEY_VERSION: "1",
    };
    const compressed = nileFormsPublicClientEvidence(
      request({}, { remoteAddress: "2001:db8::1" }),
      env
    );
    const expanded = nileFormsPublicClientEvidence(
      request({}, { remoteAddress: "2001:0db8:0000:0000:0000:0000:0000:0001" }),
      env
    );

    expect(compressed.active.ipHmac).toBe(expanded.active.ipHmac);
  });

  it("fails closed when production HMAC configuration is absent", () => {
    expect(() =>
      resolveNileFormsPublicHmacKeyring({ NODE_ENV: "production" })
    ).toThrow(NileFormsRequestSecurityError);
  });
});
