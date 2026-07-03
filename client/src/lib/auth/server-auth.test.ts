import { afterEach, describe, expect, it } from "vitest";
import { signIn } from "../../../../server/auth";

const originalEnv = {
  DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED,
  VITE_DEMO_AUTH_ENABLED: process.env.VITE_DEMO_AUTH_ENABLED,
  NILE_DEMO_PASSWORD: process.env.NILE_DEMO_PASSWORD,
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
};

afterEach(() => {
  process.env.DEMO_AUTH_ENABLED = originalEnv.DEMO_AUTH_ENABLED;
  process.env.VITE_DEMO_AUTH_ENABLED = originalEnv.VITE_DEMO_AUTH_ENABLED;
  process.env.NILE_DEMO_PASSWORD = originalEnv.NILE_DEMO_PASSWORD;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_ANON_KEY = originalEnv.VITE_SUPABASE_ANON_KEY;
});

describe("server demo auth", () => {
  function useDemoOnlyAuth() {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  }

  it("requires the configured Nile demo password when one is set", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "12345";

    await expect(signIn("s@nl.test", "wrong-password", "student")).rejects.toThrow("Invalid email, password, or role.");

    const session = await signIn("s@nl.test", "12345", "student");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("student");
    expect(session.userId).toBe("usr_student_demo");
  });

  it("keeps legacy demo-password behavior when no password env is configured", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    delete process.env.NILE_DEMO_PASSWORD;

    const session = await signIn("teacher.demo@nilelearn.local", "demo1234", "teacher");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("teacher");
  });
});
