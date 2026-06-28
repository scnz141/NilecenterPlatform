import { describe, expect, it } from "vitest";
import { getSupabaseProjectRef, resolveSupabaseBrowserConfig } from "./client";

describe("Supabase browser config", () => {
  it("prefers publishable keys over legacy anon keys", () => {
    const config = resolveSupabaseBrowserConfig({
      VITE_SUPABASE_URL: "https://demo-ref.supabase.co/",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
      VITE_SUPABASE_ANON_KEY: "legacy-anon",
    });

    expect(config.configured).toBe(true);
    expect(config.key).toBe("sb_publishable_demo");
    expect(config.keyMode).toBe("publishable");
    expect(config.url).toBe("https://demo-ref.supabase.co");
  });

  it("supports anon keys when publishable keys are not configured", () => {
    const config = resolveSupabaseBrowserConfig({
      VITE_SUPABASE_URL: "https://demo-ref.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(config.configured).toBe(true);
    expect(config.keyMode).toBe("anon");
  });

  it("does not report configured without both url and browser-safe key", () => {
    expect(resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: "https://demo-ref.supabase.co" }).configured).toBe(false);
    expect(resolveSupabaseBrowserConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo" }).configured).toBe(false);
  });

  it("extracts project refs from Supabase URLs", () => {
    expect(getSupabaseProjectRef("https://demo-ref.supabase.co")).toBe("demo-ref");
    expect(getSupabaseProjectRef("https://example.com")).toBeUndefined();
  });
});
