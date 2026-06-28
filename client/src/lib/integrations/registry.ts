import { seedPlatformState } from "@/lib/domain/seed";
import type { IntegrationConfig } from "@/lib/domain/types";
import { getSupabaseBrowserConfig } from "@/lib/supabase/client";

export const integrationRegistry: IntegrationConfig[] = seedPlatformState.integrations;
const supabaseIntegration = integrationRegistry.find((integration) => integration.id === "supabase");

export function getIntegrationStatus(id: IntegrationConfig["id"]) {
  return integrationRegistry.find((integration) => integration.id === id);
}

export function getServerOnlyIntegrationNotes() {
  return integrationRegistry
    .filter((integration) => integration.serverOnly)
    .map((integration) => `${integration.label}: ${integration.envVars.join(", ") || "no env vars yet"}`);
}

export function withRuntimeIntegrationStatus(integrations: IntegrationConfig[]) {
  const merged = supabaseIntegration && !integrations.some((integration) => integration.id === "supabase")
    ? [supabaseIntegration, ...integrations]
    : integrations;

  return merged.map((integration) => {
    if (integration.id !== "supabase") return integration;

    const config = getSupabaseBrowserConfig();
    return {
      ...integration,
      status: config.configured ? "connected" : integration.status,
      lastSyncAt: config.configured ? integration.lastSyncAt : undefined,
      notes: config.configured
        ? `Browser client is configured for ${config.projectRef ?? "the Supabase project"} using a ${config.keyMode} key. Service-role access remains server-only.`
        : integration.notes,
    } satisfies IntegrationConfig;
  });
}
