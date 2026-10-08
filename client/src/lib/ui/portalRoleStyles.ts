import { useEffect, useState } from "react";
import type { Role } from "@/lib/platformData";

const roleStyleLoaders: Partial<Record<Role, () => Promise<unknown>>> = {
  student: () => import("@/styles/roles/student"),
};

const loadedRoles = new Set<Role>();
const pendingLoads = new Map<Role, Promise<void>>();

function loadPortalRoleStyles(role: Role) {
  if (loadedRoles.has(role)) return Promise.resolve();

  const pending = pendingLoads.get(role);
  if (pending) return pending;

  const loader = roleStyleLoaders[role];
  if (!loader) {
    loadedRoles.add(role);
    return Promise.resolve();
  }
  const load = loader()
    .then(() => {
      loadedRoles.add(role);
    })
    .finally(() => {
      pendingLoads.delete(role);
    });

  pendingLoads.set(role, load);
  return load;
}

export function usePortalRoleStyles(role: Role) {
  const [ready, setReady] = useState(() => loadedRoles.has(role));

  useEffect(() => {
    let active = true;
    setReady(loadedRoles.has(role));

    void loadPortalRoleStyles(role).then(() => {
      if (active) setReady(true);
    });

    return () => {
      active = false;
    };
  }, [role]);

  return ready;
}
