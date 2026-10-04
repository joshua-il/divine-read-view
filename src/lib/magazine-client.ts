import { DEFAULT_MAGAZINE_ISSUE, type MagazineIssue } from "./types";
import { getActiveMagazineServerFn, saveMagazineServerFn } from "../functions/magazine";
import { savePdf, loadPdf } from "./pdf-store";

const ISSUE_CACHE_KEY = "nrim_active_magazine_issue";

/**
 * Get current magazine issue metadata.
 */
export async function getActiveMagazine(): Promise<MagazineIssue> {
  // Check local cache first for instant load
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(ISSUE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as MagazineIssue;
        // Reset any old stale external or WordPress URLs that fail CORS
        if (!parsed.pdfUrl || parsed.pdfUrl.includes("wp-content/uploads") || parsed.pdfUrl.startsWith("http://") || parsed.pdfUrl.startsWith("https://")) {
          parsed.pdfUrl = "/magazine.pdf";
          localStorage.setItem(ISSUE_CACHE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {
      // ignore json parse error
    }
  }

  try {
    const serverIssue = await getActiveMagazineServerFn();
    if (serverIssue && serverIssue.pdfUrl) {
      if (typeof window !== "undefined") {
        localStorage.setItem(ISSUE_CACHE_KEY, JSON.stringify(serverIssue));
      }
      return serverIssue;
    }
  } catch (err) {
    console.warn("Could not retrieve magazine from server, using local fallback", err);
  }

  return DEFAULT_MAGAZINE_ISSUE;
}

/**
 * Save new magazine metadata (for admin).
 */
export async function saveActiveMagazine(
  issue: MagazineIssue,
): Promise<{ success: boolean; issue: MagazineIssue; error?: string }> {
  if (typeof window !== "undefined") {
    localStorage.setItem(ISSUE_CACHE_KEY, JSON.stringify(issue));
  }

  try {
    const res = await saveMagazineServerFn({ data: issue });
    return res;
  } catch (err) {
    return {
      success: true,
      issue,
      error:
        err instanceof Error
          ? err.message
          : "Saved locally. Server persistence failed or server function timed out.",
    };
  }
}

/**
 * Load PDF data for the reader.
 * Prioritizes local IndexedDB storage, then fetches /magazine.pdf or target URL.
 */
export async function fetchMagazineBlob(
  issue: MagazineIssue,
): Promise<{ blob: Blob; fileName: string }> {
  // 1. Check if user/admin uploaded a custom issue in IndexedDB
  try {
    const cached = await loadPdf();
    if (cached && cached.blob) {
      return { blob: cached.blob, fileName: cached.name || issue.fileName };
    }
  } catch (e) {
    console.warn("IndexedDB load error:", e);
  }

  // 2. Fetch the magazine PDF (defaults to same-origin /magazine.pdf)
  const targetUrl = issue.pdfUrl || "/magazine.pdf";
  const response = await fetch(targetUrl);

  if (!response.ok) {
    throw new Error(
      `Unable to fetch ${targetUrl} (HTTP ${response.status}). Please upload a valid PDF issue.`,
    );
  }

  const blob = await response.blob();
  return { blob, fileName: issue.fileName };
}
