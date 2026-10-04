import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minus,
  Plus,
  Upload,
  LayoutGrid,
  Download,
  Share2,
  Lock,
  Unlock,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { DEFAULT_MAGAZINE_ISSUE, type MagazineIssue } from "@/lib/types";
import { isCurrentAdmin } from "@/lib/auth";
import { getActiveMagazine } from "@/lib/magazine-client";
import { savePdf, loadPdf } from "@/lib/pdf-store";
import { AdminModal } from "./AdminModal";

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

function PdfPage({ doc, num, height }: { doc: PDFDocumentProxy; num: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(0.707);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setRatio(base.width / base.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (height / base.height) * dpr });
      const c = ref.current;
      if (!c) return;
      c.width = vp.width;
      c.height = vp.height;
      task = page.render({ canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, num, height]);

  return (
    <canvas
      ref={ref}
      style={{ height, width: height * ratio }}
      className="block bg-ivory"
    />
  );
}

function Thumb({ doc, num, active, onClick }: { doc: PDFDocumentProxy; num: number; active: boolean; onClick: () => void }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "200px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition ${active ? "glow-ring ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
    >
      <div className="h-[120px] min-w-[84px] bg-secondary">{visible && <PdfPage doc={doc} num={num} height={120} />}</div>
      <span className="text-[10px] tracking-widest text-muted-foreground">{num}</span>
    </button>
  );
}

type Mode = "spread" | "single" | "scroll";

function LazyPage({ doc, num, height, onVisible }: { doc: PDFDocumentProxy; num: number; height: number; onVisible: (n: number) => void }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setVisible(true); }, { rootMargin: "800px" });
    const io2 = new IntersectionObserver(([e]) => { if (e?.isIntersecting) onVisible(num); }, { threshold: 0.5 });
    if (ref.current) { io.observe(ref.current); io2.observe(ref.current); }
    return () => { io.disconnect(); io2.disconnect(); };
  }, [num, onVisible]);
  return (
    <div id={`mag-page-${num}`} ref={ref} className="page-shadow scroll-mt-24 bg-ivory" style={{ minHeight: height, minWidth: visible ? undefined : height * 0.707 }}>
      {visible && <PdfPage doc={doc} num={num} height={height} />}
    </div>
  );
}

function ShareMenu({ page, onClose, issue }: { page: number; onClose: () => void; issue: MagazineIssue }) {
  const [copied, setCopied] = useState(false);
  const [withPage, setWithPage] = useState(false);
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://magazine.nrim.org";
  const url = withPage ? `${base}?page=${page}` : base;
  const title = `NRIM Magazine – ${issue.issueName}`;
  const text = issue.description || "Read the latest issue from Nations Reach International Missions.";
  const e = encodeURIComponent;
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${e(`${title} – ${url}`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { name: "X", href: `https://twitter.com/intent/tweet?text=${e(title)}&url=${e(url)}` },
    { name: "Email", href: `mailto:?subject=${e(title)}&body=${e(`${text}\n\n${url}`)}` },
  ];
  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-popover p-4 text-left shadow-xl">
      <p className="font-display text-lg">Share this issue</p>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={withPage} onChange={(ev) => setWithPage(ev.target.checked)} className="accent-primary" />
        Open at page {page}
      </label>
      <div className="mt-3 flex gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-primary rounded-md px-3 text-xs font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-center text-xs font-semibold transition hover:border-primary hover:text-primary"
          >
            {l.name}
          </a>
        ))}
      </div>
      {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
        <button
          onClick={() => navigator.share({ title, text, url }).catch(() => {})}
          className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
        >
          More options…
        </button>
      )}
    </div>
  );
}

export function MagazineReader() {
  const [issue, setIssue] = useState<MagazineIssue>(DEFAULT_MAGAZINE_ISSUE);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Loading magazine…");
  const [error, setError] = useState("");
  const [spread, setSpread] = useState(0); // index of left page (0 = cover alone)
  const [zoom, setZoom] = useState(1);
  const [isWide, setIsWide] = useState(true);
  const [showThumbs, setShowThumbs] = useState(false);
  const [mode, setMode] = useState<Mode>("spread");
  const [scrollPage, setScrollPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const onPageVisible = useCallback((n: number) => setScrollPage(n), []);
  const [stageH, setStageH] = useState(700);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check admin status
  useEffect(() => {
    setIsAdmin(isCurrentAdmin());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "true") {
        setAdminModalOpen(true);
      }
    }
  }, []);

  // Open PDF Blob into PDFJS doc
  const openBlob = useCallback(async (blob: Blob, name: string) => {
    setLoading(true);
    setLoadingStatus("Opening magazine pages…");
    setError("");
    try {
      const pdfjs = await getPdfjs();
      const data = new Uint8Array(await blob.arrayBuffer());
      const d = await pdfjs.getDocument({ data }).promise;
      setDoc(d);
      setFileName(name);
      setSpread(0);
      setFileUrl((old) => {
        if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      console.error("openBlob error:", e);
      setError("Unable to render the publication PDF. Please check the file.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Open PDF from URL (supports HTTP range requests for instant loading)
  const openUrl = useCallback(async (url: string, name: string) => {
    setLoading(true);
    setLoadingStatus("Opening magazine pages…");
    setError("");
    try {
      const pdfjs = await getPdfjs();
      const loadingTask = pdfjs.getDocument({
        url,
        withCredentials: false,
      });
      const d = await loadingTask.promise;
      setDoc(d);
      setFileName(name);
      setSpread(0);
      setFileUrl(url);
    } catch (e) {
      console.warn("Direct URL load failed, falling back to /magazine.pdf:", e);
      if (url !== "/magazine.pdf") {
        try {
          const pdfjs = await getPdfjs();
          const fallbackTask = pdfjs.getDocument({
            url: "/magazine.pdf",
            withCredentials: false,
          });
          const d = await fallbackTask.promise;
          setDoc(d);
          setFileName(name || "NRIM-Magazine.pdf");
          setSpread(0);
          setFileUrl("/magazine.pdf");
          return;
        } catch (fallbackErr) {
          console.error("Local fallback also failed:", fallbackErr);
        }
      }
      setError("Unable to render the publication PDF. Please choose a file or sign in as Admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle direct file selection
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please choose a valid PDF file.");
      return;
    }
    await openBlob(f, f.name);
    await savePdf(f);
  };

  // Initial load: runs ONCE on mount
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      setLoadingStatus("Loading magazine…");
      setError("");

      try {
        const activeIssue = await getActiveMagazine();
        if (!isMounted) return;
        setIssue(activeIssue);

        // 1. Try loading cached/uploaded PDF from IndexedDB first
        const cached = await loadPdf();
        if (cached && cached.blob) {
          if (!isMounted) return;
          await openBlob(cached.blob, cached.name || activeIssue.fileName);
          return;
        }

        // 2. Otherwise load static /magazine.pdf with HTTP range streaming
        const targetUrl = activeIssue.pdfUrl || "/magazine.pdf";
        if (!isMounted) return;
        await openUrl(targetUrl, activeIssue.fileName);
      } catch (err) {
        if (!isMounted) return;
        console.warn("Could not load default magazine:", err);
        try {
          await openUrl("/magazine.pdf", "NRIM-Magazine.pdf");
        } catch {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [openBlob, openUrl]);

  // Window resize & responsive height
  useEffect(() => {
    const measure = () => {
      setIsWide(window.innerWidth >= 900);
      const h = window.innerHeight - (document.fullscreenElement ? 120 : 260);
      setStageH(Math.max(360, h));
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
    };
  }, []);

  const total = doc?.numPages ?? 0;
  const twoUp = mode === "spread" && isWide;
  const pages: number[] = !doc ? [] : !twoUp ? [spread + 1] : spread === 0 ? [1] : [spread, spread + 1].filter((p) => p <= total);
  const canPrev = mode !== "scroll" && spread > 0;
  const canNext = mode !== "scroll" && (twoUp ? (spread === 0 ? total > 1 : spread + 2 <= total) : spread + 1 < total);
  const next = useCallback(() => canNext && setSpread((s) => (twoUp ? (s === 0 ? 2 : s + 2) : s + 1)), [canNext, twoUp]);
  const prev = useCallback(() => canPrev && setSpread((s) => (twoUp ? (s <= 2 ? 0 : s - 2) : s - 1)), [canPrev, twoUp]);

  const goTo = (p: number) => {
    if (mode === "scroll") {
      document.getElementById(`mag-page-${p}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSpread(twoUp ? (p === 1 ? 0 : p - (p % 2)) : p - 1);
  };

  const currentPage = mode === "scroll" ? scrollPage : pages[0] ?? 1;

  const switchMode = (m: Mode) => {
    const p = currentPage;
    setMode(m);
    const two = m === "spread" && isWide;
    setSpread(two ? (p === 1 ? 0 : p - (p % 2)) : p - 1);
    if (m === "scroll") setTimeout(() => document.getElementById(`mag-page-${p}`)?.scrollIntoView({ block: "start" }), 50);
  };

  // Open at ?page=N from shared links
  useEffect(() => {
    if (!doc) return;
    const p = parseInt(new URLSearchParams(window.location.search).get("page") || "", 10);
    if (p >= 1 && p <= doc.numPages) setSpread(isWide ? (p === 1 ? 0 : p - (p % 2)) : p - 1);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [next, prev]);

  // Preload neighbour pages for instant flipping
  useEffect(() => {
    if (!doc) return;
    const last = pages[pages.length - 1] ?? 1;
    const first = pages[0] ?? 1;
    [last + 1, last + 2, first - 1].forEach((p) => p >= 1 && p <= total && doc.getPage(p));
  }, [doc, spread]); // eslint-disable-line react-hooks/exhaustive-deps

  const touch = useRef(0);
  const pageH = Math.round(stageH * zoom);
  const label = mode === "scroll" ? `${scrollPage}` : pages.length === 2 ? `${pages[0]}–${pages[1]}` : `${pages[0] ?? 0}`;

  return (
    <div ref={stageRef} className="bg-stage flex min-h-full flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* Top Reader Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-8">
        <div className="min-w-0 text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
          <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
            {fileName ? fileName.replace(/\.pdf$/i, "") : issue.issueName}
          </span>
          <span className="hidden sm:inline text-muted-foreground/60">•</span>
          <span className="hidden sm:inline text-[11px] text-muted-foreground/80 truncate">
            {issue.title}
          </span>

          {/* Admin Indicator Button */}
          <button
            onClick={() => setAdminModalOpen(true)}
            className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider transition ${
              isAdmin
                ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60"
            }`}
            title={isAdmin ? "Logged in as admin@nrim.org — Manage publication" : "Admin Sign In"}
          >
            {isAdmin ? <Unlock size={11} /> : <Lock size={11} />}
            <span>Admin</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {doc && (
            <>
              <div className="mr-2 flex rounded-full border border-border p-0.5">
                {(
                  [
                    ["spread", "Spread"],
                    ["single", "Single"],
                    ["scroll", "Scroll"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${mode === m ? "btn-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <ToolBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}>
                <Minus size={16} />
              </ToolBtn>
              <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <ToolBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))}>
                <Plus size={16} />
              </ToolBtn>

              <ToolBtn label="All pages" onClick={() => setShowThumbs((s) => !s)}>
                <LayoutGrid size={16} />
              </ToolBtn>

              <ToolBtn
                label="Fullscreen"
                onClick={() => (document.fullscreenElement ? document.exitFullscreen() : stageRef.current?.requestFullscreen())}
              >
                <Maximize size={16} />
              </ToolBtn>

              <a
                href={fileUrl || issue.pdfUrl || "/magazine.pdf"}
                download={fileName || issue.fileName || "NRIM-Magazine.pdf"}
                aria-label="Download Issue PDF"
                title="Download Issue PDF"
                className="rounded-full p-2 text-foreground/80 transition hover:bg-accent hover:text-foreground"
              >
                <Download size={16} />
              </a>

              <div className="relative">
                <ToolBtn label="Share" onClick={() => setShareOpen((s) => !s)}>
                  <Share2 size={16} />
                </ToolBtn>
                {shareOpen && <ShareMenu page={currentPage} onClose={() => setShareOpen(false)} issue={issue} />}
              </div>
            </>
          )}

          {isAdmin && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary hover:text-primary"
              >
                <Upload size={13} />
                <span>{doc ? "Replace PDF" : "Upload PDF"}</span>
              </button>
              <button
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                <Sliders size={13} />
                <span>Publish</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail Bar */}
      {showThumbs && doc && (
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-background/90 px-4 py-3">
          {Array.from({ length: total }, (_, i) => (
            <Thumb key={i} doc={doc} num={i + 1} active={pages.includes(i + 1)} onClick={() => goTo(i + 1)} />
          ))}
        </div>
      )}

      {/* Main Viewing Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto px-4 py-8 min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <RefreshCw size={28} className="animate-spin text-primary" />
            <p className="font-display text-2xl text-foreground">{loadingStatus}</p>
            <p className="text-xs text-muted-foreground tracking-widest uppercase">
              Preparing high-resolution publication
            </p>
          </div>
        ) : !doc ? (
          isAdmin ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0]);
              }}
              className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center transition hover:border-primary"
            >
              <Upload className="text-primary" size={32} />
              <span className="font-display text-3xl">Upload this month's issue</span>
              <span className="text-sm text-muted-foreground">
                Drag & drop the magazine PDF here, or click to choose a file.
              </span>
              {error && <span className="text-sm text-destructive">{error}</span>}
            </button>
          ) : (
            <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-card/40 px-8 py-16 text-center">
              <span className="font-display text-3xl">Unable to Load Magazine</span>
              <span className="text-sm text-muted-foreground">
                {error || "Could not load the magazine issue. Please click retry or check back soon."}
              </span>
              <button
                onClick={() => {
                  setError("");
                  openUrl("/magazine.pdf", issue.fileName || "NRIM-Magazine.pdf");
                }}
                className="btn-primary rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-wider mt-2 flex items-center gap-2"
              >
                <RefreshCw size={14} /> Retry Loading
              </button>
              <button
                onClick={() => setAdminModalOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition mt-1 flex items-center gap-1.5"
              >
                <Lock size={12} /> Admin Sign In
              </button>
            </div>
          )
        ) : mode === "scroll" ? (
          <div className="flex flex-col items-center gap-6">
            {Array.from({ length: total }, (_, i) => (
              <LazyPage key={i} doc={doc} num={i + 1} height={pageH} onVisible={onPageVisible} />
            ))}
          </div>
        ) : (
          <div
            key={spread}
            className="flex animate-in fade-in zoom-in-[0.98] duration-300"
            onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? 0)}
            onTouchEnd={(e) => {
              const d = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
              if (d < -50) next();
              if (d > 50) prev();
            }}
          >
            <div className="page-shadow flex">
              {pages.map((p, i) => (
                <div key={p} className={`relative ${pages.length === 2 && i === 0 ? "border-r border-border" : ""}`}>
                  <PdfPage doc={doc} num={p} height={pageH} />
                </div>
              ))}
            </div>
          </div>
        )}

        {doc && !loading && (
          <>
            {mode !== "scroll" && <NavBtn side="left" disabled={!canPrev} onClick={prev} />}
            {mode !== "scroll" && <NavBtn side="right" disabled={!canNext} onClick={next} />}
          </>
        )}
      </div>

      {doc && !loading && (
        <div className="flex items-center justify-center gap-4 pb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>
            Page {label} of {total}
          </span>
        </div>
      )}

      {/* Admin Modal Component */}
      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        isAdmin={isAdmin}
        currentIssue={issue}
        onIssueUpdated={async (updated) => {
          setIssue(updated);
          const cached = await loadPdf();
          if (cached && cached.blob) {
            await openBlob(cached.blob, cached.name || updated.fileName);
          } else {
            await openUrl(updated.pdfUrl || "/magazine.pdf", updated.fileName);
          }
        }}
        onAdminStatusChange={(status) => setIsAdmin(status)}
      />
    </div>
  );
}

function ToolBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full p-2 text-foreground/80 transition hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function NavBtn({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={side === "left" ? "Previous page" : "Next page"}
      disabled={disabled}
      onClick={onClick}
      className={`fixed top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/70 p-3 backdrop-blur transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-20 ${side === "left" ? "left-3 md:left-6" : "right-3 md:right-6"}`}
    >
      {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
    </button>
  );
}
