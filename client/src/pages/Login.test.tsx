import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import Login from "./Login";

vi.mock("sonner", () => ({
  Toaster: ({ theme }: { theme?: string }) => <div data-sonner-theme={theme} />,
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function renderAt(path: string, element: React.ReactElement) {
  return renderToStaticMarkup(<Router ssrPath={path}>{element}</Router>);
}

describe("Login", () => {
  it("hides administration fields while the staff provider resolves", () => {
    const html = renderAt(
      "/auth/administration-login",
      <Login audience="administration" />
    );
    expect(html).toContain("Preparing sign in");
    expect(html).not.toContain('autoComplete="username"');
    expect(html).not.toContain('autoComplete="current-password"');
  });

  it("keeps student autocomplete fields available", () => {
    const html = renderAt("/auth/student-login", <Login audience="student" />);
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
  });

  it("renders the toaster with the app theme", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <Toaster />
      </ThemeProvider>
    );
    expect(html).toContain('data-sonner-theme="light"');
  });
});
