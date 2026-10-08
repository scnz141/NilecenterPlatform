import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { createNileFormsSeedState } from "../shared/nileFormsFixtures.js";
import type { NileFormsState } from "../shared/nileForms.js";

export class NileFormsCompatibilityRepositoryUnavailableError extends Error {
  readonly code = "forms_compatibility_repository_unavailable";

  constructor(
    message = "Nile Forms compatibility persistence is unavailable."
  ) {
    super(message);
    this.name = "NileFormsCompatibilityRepositoryUnavailableError";
  }
}

export type NileFormsCompatibilityRepository = {
  readonly kind: "memory" | "blob";
  read(): Promise<NileFormsState>;
  transaction<T>(
    operation: (state: NileFormsState) => T | Promise<T>
  ): Promise<T>;
  reset?(): Promise<void>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryNileFormsCompatibilityRepository(
  initialState: NileFormsState = createNileFormsSeedState()
): NileFormsCompatibilityRepository {
  let state = clone(initialState);
  let serial: Promise<void> = Promise.resolve();

  return {
    kind: "memory",
    async read() {
      await serial;
      return clone(state);
    },
    async transaction<T>(operation: (draft: NileFormsState) => T | Promise<T>) {
      let resolveResult: (value: T | PromiseLike<T>) => void;
      let rejectResult: (reason?: unknown) => void;
      const result = new Promise<T>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      serial = serial
        .then(async () => {
          const draft = clone(state);
          try {
            const operationResult = await operation(draft);
            state = draft;
            resolveResult(clone(operationResult));
          } catch (error) {
            rejectResult(error);
          }
        })
        .catch(() => undefined);

      return result;
    },
    async reset() {
      await serial;
      state = createNileFormsSeedState();
    },
  };
}

const DEFAULT_FORMS_BLOB_PATH = "nile-forms/state.json";
const MAX_COMMIT_ATTEMPTS = 5;

type NileFormsSnapshotPayload = {
  revision: number;
  forms: NileFormsState;
};

type BlobSnapshot = NileFormsSnapshotPayload & { etag: string };

function formsBlobPath() {
  return (
    process.env.NILE_FORMS_BLOB_PATH?.trim() || DEFAULT_FORMS_BLOB_PATH
  );
}

function serializePayload(payload: NileFormsSnapshotPayload) {
  return JSON.stringify(payload);
}

function isBlobWriteConflict(error: unknown) {
  // BlobPreconditionFailedError: the ifMatch etag went stale.
  // "conflicting operation": the store serializes writes per pathname and
  // rejects an overlapping conditional put (mapped by the SDK to a generic
  // error), so match the API's documented message.
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error &&
      error.message.includes("conflicting operation"))
  );
}

function parseSnapshot(text: string, etag: string): BlobSnapshot {
  const payload = JSON.parse(text) as {
    revision?: unknown;
    forms?: unknown;
  };
  if (
    !payload ||
    typeof payload !== "object" ||
    !Number.isInteger(payload.revision) ||
    !payload.forms ||
    typeof payload.forms !== "object" ||
    Array.isArray(payload.forms)
  ) {
    throw new NileFormsCompatibilityRepositoryUnavailableError(
      "Nile Forms blob state is malformed."
    );
  }
  return {
    revision: payload.revision as number,
    forms: payload.forms as NileFormsState,
    etag,
  };
}

async function readBlobSnapshot(pathname: string): Promise<BlobSnapshot | null> {
  let result;
  try {
    result = await get(pathname, { access: "private", useCache: false });
  } catch (error) {
    throw new NileFormsCompatibilityRepositoryUnavailableError(
      `Nile Forms blob read failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  // get() reports a weak validator (W/"…") while put() ifMatch requires the
  // strong etag for the same content; strip the weak indicator.
  return parseSnapshot(text, result.blob.etag.replace(/^W\//, ""));
}

async function ensureBlobSnapshot(pathname: string): Promise<BlobSnapshot> {
  const existing = await readBlobSnapshot(pathname);
  if (existing) return existing;
  const seed: NileFormsSnapshotPayload = {
    revision: 0,
    forms: createNileFormsSeedState(),
  };
  try {
    const stored = await put(pathname, serializePayload(seed), {
      access: "private",
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return { ...seed, etag: stored.etag };
  } catch {
    // Another instance seeded first; converge on its row.
    const seeded = await readBlobSnapshot(pathname);
    if (!seeded) {
      throw new NileFormsCompatibilityRepositoryUnavailableError(
        "Nile Forms blob state could not be seeded."
      );
    }
    return seeded;
  }
}

export function createBlobNileFormsCompatibilityRepository(): NileFormsCompatibilityRepository {
  const pathname = formsBlobPath();
  let serial: Promise<void> = Promise.resolve();

  async function commit<T>(
    operation: (draft: NileFormsState) => T | Promise<T>
  ): Promise<T> {
    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
      const snapshot = await ensureBlobSnapshot(pathname);
      const draft = clone(snapshot.forms);
      const result = await operation(draft);
      try {
        await put(
          pathname,
          serializePayload({ revision: snapshot.revision + 1, forms: draft }),
          {
            access: "private",
            allowOverwrite: true,
            addRandomSuffix: false,
            ifMatch: snapshot.etag,
            contentType: "application/json",
          }
        );
        return result;
      } catch (error) {
        if (isBlobWriteConflict(error)) {
          // Another writer committed first; retry on a fresh read.
          continue;
        }
        throw new NileFormsCompatibilityRepositoryUnavailableError(
          `Nile Forms blob commit failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    throw new NileFormsCompatibilityRepositoryUnavailableError(
      "Nile Forms blob commit exceeded the conflict retry limit."
    );
  }

  return {
    kind: "blob",
    async read() {
      await serial;
      const snapshot = await ensureBlobSnapshot(pathname);
      return clone(snapshot.forms);
    },
    async transaction<T>(operation: (draft: NileFormsState) => T | Promise<T>) {
      let resolveResult: (value: T | PromiseLike<T>) => void;
      let rejectResult: (reason?: unknown) => void;
      const result = new Promise<T>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      serial = serial
        .then(async () => {
          try {
            resolveResult(clone(await commit(operation)));
          } catch (error) {
            rejectResult(error);
          }
        })
        .catch(() => undefined);

      return result;
    },
    async reset() {
      await serial;
      try {
        await del(pathname);
      } catch (error) {
        if (error instanceof Error && error.name === "BlobNotFoundError") {
          return;
        }
        throw new NileFormsCompatibilityRepositoryUnavailableError(
          `Nile Forms blob reset failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
  };
}

let memoryRepository: NileFormsCompatibilityRepository =
  createMemoryNileFormsCompatibilityRepository();
let blobRepository: NileFormsCompatibilityRepository | null = null;
let explicitRepository: NileFormsCompatibilityRepository | null = null;

export function getNileFormsCompatibilityRepository() {
  if (explicitRepository) return explicitRepository;
  if (
    process.env.NILE_FORMS_COMPATIBILITY_STORE?.trim().toLowerCase() === "blob"
  ) {
    blobRepository ??= createBlobNileFormsCompatibilityRepository();
    return blobRepository;
  }
  return memoryRepository;
}

export function setNileFormsCompatibilityRepository(
  repository: NileFormsCompatibilityRepository
) {
  const previous = explicitRepository;
  explicitRepository = repository;
  return () => {
    explicitRepository = previous;
  };
}

export function resetDefaultNileFormsCompatibilityRepository() {
  explicitRepository = null;
  blobRepository = null;
  memoryRepository = createMemoryNileFormsCompatibilityRepository();
}
