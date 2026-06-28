import express, { type Express } from "express";
import { attachSession, endRequestSession, getRequestSession, isServerRole, signIn } from "./auth";
import { loadServerEnv } from "./env";
import { getPlatformBackendState, savePlatformBackendRecord } from "./platformRecords";
import { applyPlatformLearningAction, getPlatformStateSnapshot, parsePlatformLearningAction } from "./platformState";
import { getSupabaseServerStatus } from "./supabase";

export function registerApiRoutes(app: Express) {
  loadServerEnv();
  app.use(express.json());

  app.get("/api/integrations/supabase/status", (_req, res) => {
    res.json(getSupabaseServerStatus());
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !isServerRole(role)) {
      res.status(400).json({ error: "Email, password, and role are required." });
      return;
    }

    try {
      const session = await signIn(email, password, role);
      res.json(attachSession(res, session));
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Sign in failed." });
    }
  });

  app.get("/api/auth/session", (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.json(null);
      return;
    }
    res.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      activeRole: session.activeRole,
      provider: session.provider,
      expiresAt: session.expiresAt,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    endRequestSession(req, res);
    res.json({ ok: true });
  });

  app.get("/api/platform/records", (_req, res) => {
    res.json(getPlatformBackendState());
  });

  app.get("/api/platform/state", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    res.json(await getPlatformStateSnapshot());
  });

  app.post("/api/platform/state/actions", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    const action = parsePlatformLearningAction(req.body);
    if (!action) {
      res.status(400).json({ error: "Valid platform learning action is required." });
      return;
    }

    try {
      res.json(await applyPlatformLearningAction(action, session));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Platform action failed." });
    }
  });

  app.post("/api/platform/records", async (req, res) => {
    const { type, payload, actorId } = req.body ?? {};
    if (!["lead", "placement", "operational"].includes(type) || !payload || typeof payload !== "object") {
      res.status(400).json({ error: "Valid record type and payload are required." });
      return;
    }
    const record = await savePlatformBackendRecord(type, payload, typeof actorId === "string" ? actorId : undefined);
    res.status(201).json(record);
  });
}
