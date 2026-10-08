import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", async importOriginal => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return {
    ...actual,
    get: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    head: vi.fn(),
  };
});

import {
  BlobPreconditionFailedError,
  BlobUnknownError,
  del,
  get,
  put,
} from "@vercel/blob";
import {
  createBlobNileFormsCompatibilityRepository,
  getNileFormsCompatibilityRepository,
  NileFormsCompatibilityRepositoryUnavailableError,
  resetDefaultNileFormsCompatibilityRepository,
} from "../../../../server/nileFormsCompatibilityRepository";
import { createNileFormsSeedState } from "@shared/nileFormsFixtures";

const STATE_PATH = "nile-forms/state.json";

type StoredBlob = { content: string; etag: string };

type RecordedCall = {
  method: "get" | "put" | "del";
  pathname: string;
  options?: Record<string, unknown>;
  body?: string;
};

function blobMeta(pathname: string, blob: StoredBlob) {
  return {
    url: `https://blob.test/${pathname}`,
    downloadUrl: `https://blob.test/${pathname}?download=1`,
    pathname,
    contentDisposition: "inline",
    cacheControl: "no-cache",
    uploadedAt: new Date("2026-01-01T00:00:00Z"),
    etag: blob.etag,
    contentType: "application/json",
    size: blob.content.length,
  };
}

function fakeBlobStore(options: {
  blobs?: Map<string, StoredBlob>;
  /** Called before each conditional put is evaluated; lets a rival writer bump state. */
  beforePut?: () => void;
  failGet?: unknown;
  failPut?: unknown;
}) {
  const blobs = options.blobs ?? new Map<string, StoredBlob>();
  const calls: RecordedCall[] = [];
  let etagCounter = 0;

  vi.mocked(get).mockImplementation(async (pathname, getOptions) => {
    calls.push({
      method: "get",
      pathname: String(pathname),
      options: getOptions as Record<string, unknown>,
    });
    if (options.failGet) throw options.failGet;
    const blob = blobs.get(String(pathname));
    if (!blob) return null;
    // Like the real API, get() reports a weak validator W/"…"; ifMatch on
    // put() expects the strong form.
    return {
      statusCode: 200 as const,
      stream: new Response(blob.content).body!,
      headers: new Headers(),
      blob: { ...blobMeta(String(pathname), blob), etag: `W/${blob.etag}` },
    };
  });

  vi.mocked(put).mockImplementation(async (pathname, body, putOptions) => {
    calls.push({
      method: "put",
      pathname: String(pathname),
      options: putOptions as Record<string, unknown>,
      body: String(body),
    });
    if (options.failPut) throw options.failPut;
    options.beforePut?.();
    const existing = blobs.get(String(pathname));
    if (putOptions.ifMatch !== undefined) {
      if (!existing || existing.etag !== putOptions.ifMatch) {
        throw new BlobPreconditionFailedError();
      }
    } else if (existing && !putOptions.allowOverwrite) {
      throw new BlobUnknownError();
    }
    const etag = `etag-${(etagCounter += 1)}`;
    blobs.set(String(pathname), { content: String(body), etag });
    return { ...blobMeta(String(pathname), blobs.get(String(pathname))!) };
  });

  vi.mocked(del).mockImplementation(async pathname => {
    calls.push({ method: "del", pathname: String(pathname) });
    blobs.delete(String(pathname));
  });

  return { blobs, calls };
}

function storedState(revision: number): StoredBlob {
  return {
    content: JSON.stringify({ revision, forms: createNileFormsSeedState() }),
    etag: `"seed-${revision}"`,
  };
}

function readForms(blob: StoredBlob) {
  return JSON.parse(blob.content) as {
    revision: number;
    forms: ReturnType<typeof createNileFormsSeedState>;
  };
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "stub-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetDefaultNileFormsCompatibilityRepository();
});

describe("vercel blob Nile Forms compatibility repository", () => {
  it("seeds a missing blob once and returns the seed state", async () => {
    const store = fakeBlobStore({});
    const repository = createBlobNileFormsCompatibilityRepository();

    const state = await repository.read();

    expect(state.definitions.length).toBe(
      createNileFormsSeedState().definitions.length
    );
    const seedPut = store.calls.filter(call => call.method === "put");
    expect(seedPut).toHaveLength(1);
    expect(seedPut[0]?.pathname).toBe(STATE_PATH);
    expect(seedPut[0]?.options).toMatchObject({
      access: "private",
      allowOverwrite: false,
      addRandomSuffix: false,
    });
    expect(readForms(store.blobs.get(STATE_PATH)!).revision).toBe(0);
    expect(
      store.calls.every(
        call => call.method !== "get" || call.options?.useCache === false
      )
    ).toBe(true);

    await repository.read();
    expect(store.calls.filter(call => call.method === "put")).toHaveLength(1);
  });

  it("commits with ifMatch on the read etag, bumps revision, returns the op result", async () => {
    const store = fakeBlobStore({
      blobs: new Map([[STATE_PATH, storedState(3)]]),
    });
    const repository = createBlobNileFormsCompatibilityRepository();

    const result = await repository.transaction(state => {
      state.definitions = [];
      return "committed";
    });

    expect(result).toBe("committed");
    const commit = store.calls.find(
      call => call.method === "put" && call.options?.ifMatch !== undefined
    );
    expect(commit?.options?.ifMatch).toBe('"seed-3"');
    expect(commit?.options?.allowOverwrite).toBe(true);
    const stored = readForms(store.blobs.get(STATE_PATH)!);
    expect(stored.revision).toBe(4);
    expect(stored.forms.definitions).toEqual([]);
  });

  it("retries on a precondition conflict and returns the result of the second run", async () => {
    const blobs = new Map([[STATE_PATH, storedState(0)]]);
    let rivalWrites = 0;
    const store = fakeBlobStore({
      blobs,
      beforePut: () => {
        if (rivalWrites !== 0) return;
        rivalWrites += 1;
        const forms = createNileFormsSeedState();
        forms.definitions = [];
        blobs.set(STATE_PATH, {
          content: JSON.stringify({ revision: 1, forms }),
          etag: '"rival"',
        });
      },
    });
    const repository = createBlobNileFormsCompatibilityRepository();

    const drafts: number[] = [];
    const result = await repository.transaction(state => {
      drafts.push(state.definitions.length);
      return `attempt-${drafts.length}`;
    });

    expect(result).toBe("attempt-2");
    expect(drafts).toHaveLength(2);
    // Second attempt ran on the rival-writer state (definitions emptied).
    expect(drafts[1]).toBe(0);
    expect(readForms(blobs.get(STATE_PATH)!).revision).toBe(2);
    const puts = store.calls.filter(
      call => call.method === "put" && call.options?.ifMatch !== undefined
    );
    expect(puts[0]?.options?.ifMatch).toBe('"seed-0"');
    expect(puts[1]?.options?.ifMatch).toBe('"rival"');
  });

  it("retries when the store rejects an overlapping conditional put", async () => {
    // The API reports concurrent writes on one pathname as a generic
    // "conflicting operation" error rather than precondition_failed.
    const blobs = new Map([[STATE_PATH, storedState(0)]]);
    let conflicts = 0;
    const store = fakeBlobStore({
      blobs,
      beforePut: () => {
        if (conflicts !== 0) return;
        conflicts += 1;
        const current = readForms(blobs.get(STATE_PATH)!);
        blobs.set(STATE_PATH, {
          content: JSON.stringify({
            revision: current.revision + 1,
            forms: current.forms,
          }),
          etag: '"rival"',
        });
        throw Object.assign(new BlobUnknownError(), {
          message:
            "Vercel Blob: The conditional request cannot succeed due to a conflicting operation against this resource.",
        });
      },
    });
    const repository = createBlobNileFormsCompatibilityRepository();

    const result = await repository.transaction(state => {
      state.definitions = [];
      return "committed-after-conflict";
    });

    expect(result).toBe("committed-after-conflict");
    expect(readForms(blobs.get(STATE_PATH)!).revision).toBe(2);
    expect(
      store.calls.filter(
        call => call.method === "put" && call.options?.ifMatch !== undefined
      )
    ).toHaveLength(2);
  });

  it("throws the unavailable error after five conflicts", async () => {
    const blobs = new Map([[STATE_PATH, storedState(0)]]);
    const store = fakeBlobStore({
      blobs,
      beforePut: () => {
        const current = readForms(blobs.get(STATE_PATH)!);
        blobs.set(STATE_PATH, {
          content: JSON.stringify({
            revision: current.revision + 1,
            forms: current.forms,
          }),
          etag: `"rival-${current.revision + 1}"`,
        });
      },
    });
    const repository = createBlobNileFormsCompatibilityRepository();

    await expect(repository.transaction(() => "never")).rejects.toBeInstanceOf(
      NileFormsCompatibilityRepositoryUnavailableError
    );
    expect(
      store.calls.filter(
        call => call.method === "put" && call.options?.ifMatch !== undefined
      )
    ).toHaveLength(5);
  });

  it("propagates a business error without writing", async () => {
    const store = fakeBlobStore({
      blobs: new Map([[STATE_PATH, storedState(1)]]),
    });
    const repository = createBlobNileFormsCompatibilityRepository();
    const businessError = Object.assign(new Error("not allowed"), {
      code: "form_denied",
    });

    await expect(
      repository.transaction(() => {
        throw businessError;
      })
    ).rejects.toBe(businessError);
    expect(store.calls.filter(call => call.method === "put")).toHaveLength(0);
    expect(readForms(store.blobs.get(STATE_PATH)!).revision).toBe(1);
  });

  it("throws the unavailable error on an SDK failure", async () => {
    const store = fakeBlobStore({ failGet: new Error("socket hangup") });
    const repository = createBlobNileFormsCompatibilityRepository();

    await expect(repository.read()).rejects.toBeInstanceOf(
      NileFormsCompatibilityRepositoryUnavailableError
    );
    await expect(repository.transaction(() => "never")).rejects.toBeInstanceOf(
      NileFormsCompatibilityRepositoryUnavailableError
    );
  });

  it("selects the blob repository only when the env switch is set", () => {
    fakeBlobStore({});
    vi.stubEnv("NILE_FORMS_COMPATIBILITY_STORE", "blob");
    expect(getNileFormsCompatibilityRepository().kind).toBe("blob");
    expect(getNileFormsCompatibilityRepository()).toBe(
      getNileFormsCompatibilityRepository()
    );

    vi.stubEnv("NILE_FORMS_COMPATIBILITY_STORE", "memory");
    expect(getNileFormsCompatibilityRepository().kind).toBe("memory");

    vi.unstubAllEnvs();
    expect(getNileFormsCompatibilityRepository().kind).toBe("memory");
  });
});
