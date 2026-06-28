import fs from "node:fs";
import path from "node:path";

let loaded = false;

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsAt = trimmed.indexOf("=");
  if (equalsAt === -1) return null;
  const key = trimmed.slice(0, equalsAt).trim();
  const rawValue = trimmed.slice(equalsAt + 1).trim();
  const value =
    (rawValue.startsWith("\"") && rawValue.endsWith("\"")) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;
  return key ? { key, value } : null;
}

export function loadServerEnv() {
  if (loaded) return;
  loaded = true;

  [".env", ".env.local"].forEach((filename) => {
    const envPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    lines.forEach((line) => {
      const parsed = parseEnvLine(line);
      if (parsed && process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    });
  });
}
