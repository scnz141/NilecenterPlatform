import { useEffect, useState } from "react";
import { getStoredAuthSession } from "@/lib/auth/session";
import { fetchNccDirectoryBranchesRequest } from "@/lib/backend/api";

export function useNccWorkspaceBranchName() {
  const session = getStoredAuthSession();
  const [branchName, setBranchName] = useState("Selected branch");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetchNccDirectoryBranchesRequest();
      if (cancelled || !response.ok || !response.data) return;
      setBranchName(
        response.data.items.find(
          branch => branch.id === session?.workspaceBranchId
        )?.name ?? "Selected branch"
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.workspaceBranchId]);

  return branchName;
}
