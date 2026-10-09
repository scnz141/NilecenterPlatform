import { afterEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "@/lib/backend/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiJson error details", () => {
  it("maps EMS details arrays into per-field messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          error: "Validation failed: phone value is not a valid phone number",
          details: [
            {
              type: "value_error",
              loc: ["body", "phone"],
              msg: "value is not a valid phone number",
              input: "notaphone",
            },
          ],
        })
      )
    );

    const result = await apiJson("/api/ncc/admissions/leads", {
      method: "POST",
      body: "{}",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(result.details).toEqual({
      phone: ["value is not a valid phone number"],
    });
  });

  it("skips the body segment and keeps object details as-is", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, {
          error: "Bad request",
          details: { email: ["Email is invalid."] },
        })
      )
    );

    const result = await apiJson("/api/x", { method: "POST", body: "{}" });
    expect(result.details).toEqual({ email: ["Email is invalid."] });
  });

  it("returns undefined details when the array has no usable entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, { error: "Invalid", details: [{ foo: 1 }] })
      )
    );

    const result = await apiJson("/api/x", { method: "POST", body: "{}" });
    expect(result.details).toBeUndefined();
  });
});
