import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./index";

type VercelCatchAllRequest = IncomingMessage & {
  query?: {
    path?: string | string[];
  };
  url?: string;
};

export default function handler(req: VercelCatchAllRequest, res: ServerResponse) {
  const path = req.query?.path;
  if (path) {
    const segments = Array.isArray(path) ? path : [path];
    const suffix = segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
    const queryIndex = req.url?.indexOf("?") ?? -1;
    const queryString = queryIndex >= 0 && req.url ? req.url.slice(queryIndex) : "";
    req.url = `/api/${suffix}${queryString}`;
  }

  return (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
