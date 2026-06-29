import express from "express";
import { registerApiRoutes } from "../server/routes";

const app = express();

// Register the API routes under /api
registerApiRoutes(app);

// Export the Express app for Vercel Serverless
export default app;
