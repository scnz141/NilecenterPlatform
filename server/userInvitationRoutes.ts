import { getRequestSession } from "./auth.js";
import {
  SupabaseInvitationProviderUnavailableError,
  SupabaseInvitationVerificationError,
} from "./supabaseAuthInvitations.js";
import {
  UserInvitationConflictError,
  UserInvitationRepositoryUnavailableError,
} from "./userInvitationRepository.js";
import {
  UserInvitationService,
  UserInvitationValidationError,
} from "./userInvitationService.js";

type InvitationRequest = {
  body?: Record<string, unknown>;
  headers: { cookie?: string };
};
type InvitationResponse = {
  status(code: number): InvitationResponse;
  json(body: unknown): void;
};
type InvitationApp = {
  post(
    path: string,
    handler: (
      req: InvitationRequest,
      res: InvitationResponse
    ) => void | Promise<void>
  ): void;
};

function enabled(value: unknown) {
  return ["1", "true", "yes"].includes(String(value ?? "").toLowerCase());
}

function respondWithInvitationError(error: unknown, res: InvitationResponse) {
  if (error instanceof UserInvitationValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (
    error instanceof UserInvitationConflictError ||
    error instanceof SupabaseInvitationVerificationError
  ) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (
    error instanceof UserInvitationRepositoryUnavailableError ||
    error instanceof SupabaseInvitationProviderUnavailableError
  ) {
    res.status(503).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Account invitation could not be completed." });
}

export function registerUserInvitationRoutes(
  app: InvitationApp,
  service = new UserInvitationService(),
  env: NodeJS.ProcessEnv = process.env
) {
  app.post("/api/admin/user-invitations", async (req, res) => {
    if (!enabled(env.NILE_NORMALIZED_INVITATIONS_ENABLED)) {
      res
        .status(503)
        .json({ error: "Normalized account invitations are not active." });
      return;
    }
    const session = await getRequestSession(req);
    if (
      !session ||
      session.provider !== "supabase" ||
      session.authorizationModel !== "normalized" ||
      session.activeRole !== "superadmin"
    ) {
      res
        .status(403)
        .json({ error: "Normalized Super Admin access is required." });
      return;
    }
    try {
      const result = await service.create({
        sessionToken: session.id,
        fullName: req.body?.fullName,
        email: req.body?.email,
        phone: req.body?.phone,
        role: req.body?.role,
        branchRef: req.body?.branchRef,
        departmentRef: req.body?.departmentRef,
        title: req.body?.title,
        availabilityStatus: req.body?.availabilityStatus,
        subjects: req.body?.subjects,
        teachingLevels: req.body?.teachingLevels,
        locale: req.body?.locale,
        idempotencyKey: req.body?.idempotencyKey,
      });
      res.status(202).json({ ok: true, invitation: result });
    } catch (error) {
      respondWithInvitationError(error, res);
    }
  });

  app.post("/api/auth/invitations/accept", async (req, res) => {
    if (!enabled(env.NILE_NORMALIZED_INVITATIONS_ENABLED)) {
      res
        .status(503)
        .json({ error: "Normalized account invitations are not active." });
      return;
    }
    try {
      const result = await service.accept({
        invitationId: req.body?.invitationId,
        email: req.body?.email,
        otp: req.body?.otp,
        accessToken: req.body?.accessToken,
        password: req.body?.password,
      });
      res.json({ ok: true, account: result });
    } catch (error) {
      respondWithInvitationError(error, res);
    }
  });
}
