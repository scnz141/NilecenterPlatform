import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./routes.js";
import { initializeNileFormsRepository } from "./nileFormsRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  await initializeNileFormsRepository();

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    next();
  });

  registerApiRoutes(app);

  // Serve static files from dist
  const staticPath = path.resolve(__dirname, "..", "dist");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "127.0.0.1";

  server.listen(Number(port), host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(console.error);
