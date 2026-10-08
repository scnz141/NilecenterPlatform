import type { IncomingMessage, ServerResponse } from "node:http";

type VercelCatchAllRequest = IncomingMessage & {
  query?: {
    path?: string | string[];
  };
  url?: string;
};

type ExpressHandler = (request: IncomingMessage, response: ServerResponse) => void;

let appPromise: Promise<ExpressHandler> | null = null;

async function loadApp() {
  appPromise ??= import("./index.js").then((module) => module.default as unknown as ExpressHandler);
  return appPromise;
}

function sendStartupError(res: ServerResponse, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown API startup failure.";
  console.error("[nile-learn-api-startup]", error);
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "API service is starting or misconfigured.", detail: message }));
}

export default async function handler(req: VercelCatchAllRequest, res: ServerResponse) {
  const path = req.query?.path;
  if (path) {
    const segments = Array.isArray(path) ? path : [path];
    const suffix = segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
    // Vercel appends the catch-all segments as `path=…`; drop it so routes
    // with strict query allowlists see only the caller's own parameters.
    const queryIndex = req.url?.indexOf("?") ?? -1;
    const params = new URLSearchParams(queryIndex >= 0 && req.url ? req.url.slice(queryIndex + 1) : "");
    params.delete("path");
    const queryString = params.toString();
    req.url = `/api/${suffix}${queryString ? `?${queryString}` : ""}`;
  }

  try {
    const app = await loadApp();
    return app(req, res);
  } catch (error) {
    appPromise = null;
    sendStartupError(res, error);
  }
}
