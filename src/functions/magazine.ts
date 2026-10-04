import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_MAGAZINE_ISSUE, type MagazineIssue } from "../lib/types";

// In-memory server fallback cache across requests on the same instance
let serverActiveIssue: MagazineIssue = { ...DEFAULT_MAGAZINE_ISSUE };

const MANIFEST_BLOB_PATH = "nrim-magazine/manifest.json";

/**
 * Fetch the active magazine issue metadata.
 * Tries Vercel Blob first (if BLOB_READ_WRITE_TOKEN is configured),
 * otherwise falls back to memory / default issue.
 */
export const getActiveMagazineServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MagazineIssue> => {
    try {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN;
      if (blobToken) {
        const { list } = await import("@vercel/blob");
        const { blobs } = await list({ prefix: MANIFEST_BLOB_PATH, token: blobToken });
        const manifestBlob = blobs.find((b) => b.pathname === MANIFEST_BLOB_PATH);
        if (manifestBlob) {
          const res = await fetch(manifestBlob.url, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as MagazineIssue;
            serverActiveIssue = data;
            return data;
          }
        }
      }
    } catch (err) {
      console.warn("[server] Could not load magazine from Vercel Blob:", err);
    }

    return serverActiveIssue;
  },
);

/**
 * Save new magazine issue metadata.
 * Persists to Vercel Blob if available, and updates server cache.
 */
export const saveMagazineServerFn = createServerFn({ method: "POST" })
  .validator((data: MagazineIssue) => data)
  .handler(
    async ({ data }): Promise<{ success: boolean; issue: MagazineIssue; error?: string }> => {
      try {
        serverActiveIssue = {
          ...data,
          updatedAt: new Date().toISOString(),
        };

        const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN;
        if (blobToken) {
          const { put } = await import("@vercel/blob");
          await put(MANIFEST_BLOB_PATH, JSON.stringify(serverActiveIssue, null, 2), {
            access: "public",
            addRandomSuffix: false,
            contentType: "application/json",
            token: blobToken,
          });
        }

        return { success: true, issue: serverActiveIssue };
      } catch (err) {
        console.error("[server] Failed to save magazine issue:", err);
        return {
          success: false,
          issue: serverActiveIssue,
          error: err instanceof Error ? err.message : "Failed to persist issue on server",
        };
      }
    },
  );
