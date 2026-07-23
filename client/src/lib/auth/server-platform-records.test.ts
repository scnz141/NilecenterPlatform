import { describe, expect, it } from "vitest";
import { platformRecordLocalFallbackAllowed } from "../../../../server/platformRecords";

describe("platform record persistence boundary", () => {
  it("fails closed on Vercel and normalized staging", () => {
    expect(platformRecordLocalFallbackAllowed({ VERCEL: "1" })).toBe(false);
    expect(
      platformRecordLocalFallbackAllowed({
        NILE_RUNTIME_PROFILE: "normalized-staging",
      })
    ).toBe(false);
  });

  it("allows local fallback only for local compatibility or explicit QA", () => {
    expect(platformRecordLocalFallbackAllowed({})).toBe(true);
    expect(
      platformRecordLocalFallbackAllowed({
        VERCEL: "1",
        NILE_PLATFORM_RECORDS_LOCAL_ONLY: "1",
      })
    ).toBe(true);
  });
});
