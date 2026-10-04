import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  File as FileIcon,
  LayoutGrid,
  Lock,
  Maximize,
  Minimize,
  Minus,
  Plus,
  RefreshCw,
  ScrollText,
  Share2,
  Sliders,
  Unlock,
  Upload,
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

type Mode = "spread" | "single" | "scroll";

const GAP = 16; // vertical gap between pages in scroll mode
const PAD = 16; // top / bottom padding inside the scroll area
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const MAX_CANVAS_PIXELS = 14_000_000; // keeps mobile browsers from running out of memory

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

/**
 * Renders one PDF page. The page is drawn to an off-screen canvas first and then copied
 * onto the visible canvas in a single step, so the page never goes blank while re-rendering
 * (this is what used to cause the flicker). Re-renders after zoom/resize are debounced.
 * The canvas always fills its parent, which owns the layout size.
 */
function PdfPage({ doc, num, height }: { doc: PDFDocumentProxy; num: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [renderH, setRenderH] = useState(height);

  useEffect(() => {
    if (height === renderH) return;
    const t = setTimeout(() => setRenderH(height), 180);
    return () => clearTimeout(t);
  }, [height, renderH]);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(num);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let scale = (renderH / base.height) * dpr;
        const pixels = base.width * scale * (base.height * scale);
        if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const vp = page.getViewport({ scale });
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(vp.width));
        off.height = Math.max(1, Math.floor(vp.height));
        task = page.render({ canvasContext: off.getContext("2d")!, viewport: vp });
        await task.promise;
        if (cancelled) return;
        const c = ref.current;
        if (!c) return;
        c.width = off.width;
        c.height = off.height;
        c.getContext("2d")!.drawImage(off, 0, 0);
      } catch {
        // render cancelled or document closed
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, num, renderH]);

  return <canvas ref={ref} className="block h-full w-full bg-ivory" />;
}

function Thumb({
  doc,
  num,
  ratio,
  active,
  onClick,
}: {
  doc: PDFDocumentProxy;
  num: number;
  ratio: number;
  active: boolean;
  onClick: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), {
      rootMargin: "200px",
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={`Go to page ${num}`}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition ${active ? "glow-ring ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
    >
      <div className="bg-secondary" style={{ height: 96, width: 96 * ratio }}>
        {visible && <PdfPage doc={doc} num={num} height={96} />}
      </div>
      <span className="text-[10px] tracking-widest text-muted-foreground">{num}</span>
    </button>
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
    <div className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-4 text-left shadow-xl">
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
  const [ratio, setRatio] = useState(0.707); // page width / height
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Loading magazine…");
  const [error, setError] = useState("");
  const [spread, setSpread] = useState(0); // index of left page in page modes (0 = cover alone)
  const [zoom, setZoom] = useState(1);
  const [showThumbs, setShowThumbs] = useState(false);
  const [mode, setMode] = useState<Mode>("scroll");
  const [scrollPage, setScrollPage] = useState(1);
  const [range, setRange] = useState<[number, number]>([0, 3]); // pages near the viewport (scroll mode)
  const [shareOpen, setShareOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollFrac = useRef(0); // scroll position expressed in "pages", survives zoom / resize
  const rafRef = useRef(0);
  const touch = useRef(0);
  const pageParamHandled = useRef(false);

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
      const first = await d.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      setRatio(vp.width / vp.height);
      setDoc(d);
      setFileName(name);
      setSpread(0);
      scrollFrac.current = 0;
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
    const load = async (target: string) => {
      const pdfjs = await getPdfjs();
      const d = await pdfjs.getDocument({ url: target, withCredentials: false }).promise;
      const first = await d.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      setRatio(vp.width / vp.height);
      setDoc(d);
      setSpread(0);
      scrollFrac.current = 0;
      setFileUrl(target);
    };
    try {
      await load(url);
      setFileName(name);
    } catch (e) {
      console.warn("Direct URL load failed, falling back to /magazine.pdf:", e);
      if (url !== "/magazine.pdf") {
        try {
          await load("/magazine.pdf");
          setFileName(name || "NRIM-Magazine.pdf");
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

  // Track the size of the reading area
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fullscreen state
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const total = doc?.numPages ?? 0;
  const narrow = stage.w > 0 && stage.w < 700;
  const twoUp = mode === "spread" && !narrow;

  // ---- Layout maths ------------------------------------------------------------------
  const sidePad = stage.w < 640 ? 8 : 24;
  // Scroll mode: pages fit the width of the reader; zoom scales from there.
  const maxFitW = ratio < 1 ? 860 : 1200;
  const fitW = Math.max(120, Math.min(stage.w - sidePad * 2, maxFitW));
  const scrollPageW = Math.round(fitW * zoom);
  const scrollPageH = Math.round(scrollPageW / ratio);
  const stride = scrollPageH + GAP;
  // Page modes: pages fit both the height and width of the reader; zoom scales from there.
  const n = twoUp ? 2 : 1;
  const fitH = Math.max(
    160,
    Math.min(stage.h - 32, (stage.w - sidePad * 2) / (ratio * n)),
  );
  const flipH = Math.round(fitH * zoom);
  const flipW = Math.round(flipH * ratio);

  const pages: number[] = !doc
    ? []
    : !twoUp
      ? [spread + 1]
      : spread === 0
        ? [1]
        : [spread, spread + 1].filter((p) => p <= total);
  const canPrev = mode !== "scroll" && spread > 0;
  const canNext =
    mode !== "scroll" &&
    (twoUp ? (spread === 0 ? total > 1 : spread + 2 <= total) : spread + 1 < total);
  const next = useCallback(
    () => canNext && setSpread((s) => (twoUp ? (s === 0 ? 2 : s + 2) : s + 1)),
    [canNext, twoUp],
  );
  const prev = useCallback(
    () => canPrev && setSpread((s) => (twoUp ? (s <= 2 ? 0 : s - 2) : s - 1)),
    [canPrev, twoUp],
  );

  const currentPage = mode === "scroll" ? scrollPage : (pages[0] ?? 1);
  const label =
    mode === "scroll"
      ? `${scrollPage}`
      : pages.length === 2
        ? `${pages[0]}–${pages[1]}`
        : `${pages[0] ?? 0}`;

  const spreadFor = (p: number, two: boolean) => (two ? (p === 1 ? 0 : p - (p % 2)) : p - 1);

  const goTo = useCallback(
    (p: number) => {
      if (mode === "scroll") {
        scrollerRef.current?.scrollTo({ top: PAD + (p - 1) * stride, behavior: "smooth" });
        return;
      }
      setSpread(spreadFor(p, twoUp));
    },
    [mode, stride, twoUp],
  );

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    const p = currentPage;
    setMode(m);
    if (m === "scroll") {
      scrollFrac.current = p - 1;
      setScrollPage(p);
    } else {
      setSpread(spreadFor(p, m === "spread" && !narrow));
    }
  };

  // ---- Scroll mode: current page + which pages to render -----------------------------
  const syncScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || mode !== "scroll" || !stride) return;
    const t = el.scrollTop;
    const first = Math.max(0, Math.floor((t - PAD) / stride));
    const last = Math.floor((t - PAD + el.clientHeight) / stride);
    setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]));
    const cur = Math.max(1, Math.floor((t - PAD + el.clientHeight * 0.35) / stride) + 1);
    setScrollPage(Math.min(cur, Math.max(1, total)));
  }, [mode, stride, total]);

  const onScroll = () => {
    if (mode !== "scroll" || !stride) return;
    const el = scrollerRef.current;
    if (el) scrollFrac.current = (el.scrollTop - PAD) / stride;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      syncScroll();
    });
  };

  // When pages change size (zoom / resize / mode switch) keep the reader on the same page.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !doc) return;
    if (mode === "scroll") {
      el.scrollTop = PAD + Math.max(0, scrollFrac.current) * stride;
      syncScroll();
    } else {
      el.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stride, mode, doc]);

  // Open at ?page=N from shared links
  useEffect(() => {
    if (!doc || pageParamHandled.current || !stage.w) return;
    pageParamHandled.current = true;
    const p = parseInt(new URLSearchParams(window.location.search).get("page") || "", 10);
    if (!(p >= 1 && p <= doc.numPages)) return;
    scrollFrac.current = p - 1;
    setScrollPage(p);
    setSpread(spreadFor(p, false));
    const el = scrollerRef.current;
    if (el && mode === "scroll") el.scrollTop = PAD + (p - 1) * stride;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, stage.w]);

  // Keyboard navigation (page modes)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [next, prev]);

  // Ctrl/⌘ + wheel and trackpad pinch zoom the magazine instead of the whole site
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z - e.deltaY * 0.01));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Preload neighbour pages for instant flipping (page modes)
  useEffect(() => {
    if (!doc || mode === "scroll") return;
    const last = pages[pages.length - 1] ?? 1;
    const first = pages[0] ?? 1;
    [last + 1, last + 2, first - 1].forEach((p) => p >= 1 && p <= total && doc.getPage(p).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, spread, mode]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const zoomIn = () => setZoom((z) => clampZoom(z + 0.25));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.25));

  const modeButtons: [Mode, string, React.ReactNode][] = [
    ["scroll", "Scroll", <ScrollText key="s" size={15} />],
    ["single", "Single", <FileIcon key="p" size={15} />],
    ["spread", "Spread", <BookOpen key="b" size={15} />],
  ];

  return (
    <div
      ref={rootRef}
      className={`bg-stage flex flex-col ${isFs ? "h-dvh" : "h-[calc(100dvh-5.5rem)] max-h-[1100px] min-h-[520px]"}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* Top bar: title, admin, download, share */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-2 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="max-w-[40vw] truncate font-semibold text-foreground sm:max-w-xs">
            {fileName ? fileName.replace(/\.pdf$/i, "") : issue.issueName}
          </span>
          <span className="hidden text-[11px] text-muted-foreground/80 md:inline truncate">{issue.title}</span>
          <button
            onClick={() => setAdminModalOpen(true)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider transition ${
              isAdmin
                ? "border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30"
                : "text-muted-foreground/60 hover:bg-secondary/60 hover:text-foreground"
            }`}
            title={isAdmin ? "Logged in as admin@nrim.org — Manage publication" : "Admin Sign In"}
          >
            {isAdmin ? <Unlock size={11} /> : <Lock size={11} />}
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {doc && (
            <>
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
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-primary hover:text-primary"
                aria-label={doc ? "Replace PDF" : "Upload PDF"}
              >
                <Upload size={13} />
                <span className="hidden md:inline">{doc ? "Replace PDF" : "Upload PDF"}</span>
              </button>
              <button
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary transition hover:bg-primary hover:text-primary-foreground"
                aria-label="Publish"
              >
                <Sliders size={13} />
                <span className="hidden md:inline">Publish</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reading area — scrolls on its own, so the mouse wheel only moves the magazine */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          tabIndex={0}
          onScroll={onScroll}
          className="h-full overflow-auto overscroll-contain outline-none [-webkit-overflow-scrolling:touch]"
          style={{ scrollbarGutter: "stable" }}
        >
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <RefreshCw size={28} className="animate-spin text-primary" />
              <p className="font-display text-2xl text-foreground">{loadingStatus}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Preparing high-resolution publication
              </p>
            </div>
          ) : !doc ? (
            <div className="flex h-full items-center justify-center px-4">
              {isAdmin ? (
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
                    className="btn-primary mt-2 flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-wider"
                  >
                    <RefreshCw size={14} /> Retry Loading
                  </button>
                  <button
                    onClick={() => setAdminModalOpen(true)}
                    className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    <Lock size={12} /> Admin Sign In
                  </button>
                </div>
              )}
            </div>
          ) : mode === "scroll" ? (
            <div
              className="mx-auto flex w-max min-w-full flex-col items-center"
              style={{ gap: GAP, padding: `${PAD}px ${sidePad}px` }}
            >
              {Array.from({ length: total }, (_, i) => {
                const render = i >= range[0] - 2 && i <= range[1] + 2;
                return (
                  <div
                    key={i}
                    id={`mag-page-${i + 1}`}
                    className="page-shadow shrink-0 bg-ivory"
                    style={{ width: scrollPageW, height: scrollPageH }}
                  >
                    {render && <PdfPage doc={doc} num={i + 1} height={scrollPageH} />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="flex min-h-full min-w-full items-center justify-center"
              style={{ padding: `16px ${sidePad}px` }}
              onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? 0)}
              onTouchEnd={(e) => {
                if (zoom > 1) return; // let the user pan when zoomed in
                const d = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
                if (d < -50) next();
                if (d > 50) prev();
              }}
            >
              <div className="page-shadow flex shrink-0">
                {pages.map((p, i) => (
                  <div
                    key={p}
                    className={`shrink-0 ${pages.length === 2 && i === 0 ? "border-r border-border" : ""}`}
                    style={{ width: flipW, height: flipH }}
                  >
                    <PdfPage doc={doc} num={p} height={flipH} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {doc && !loading && mode !== "scroll" && (
          <>
            <NavBtn side="left" disabled={!canPrev} onClick={prev} />
            <NavBtn side="right" disabled={!canNext} onClick={next} />
          </>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbs && doc && (
        <div className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain border-t border-border bg-background/90 px-3 py-2">
          {Array.from({ length: total }, (_, i) => (
            <Thumb
              key={i}
              doc={doc}
              num={i + 1}
              ratio={ratio}
              active={mode === "scroll" ? scrollPage === i + 1 : pages.includes(i + 1)}
              onClick={() => goTo(i + 1)}
            />
          ))}
        </div>
      )}

      {/* Bottom control bar: view mode · page · zoom · tools */}
      {doc && !loading && (
        <div className="shrink-0 border-t border-border bg-background/90 px-2 py-2 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {/* View mode */}
            <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="View mode">
              {modeButtons.map(([m, l, icon]) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  aria-label={`${l} view`}
                  aria-pressed={mode === m}
                  title={`${l} view`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition sm:px-3 ${
                    mode === m ? "btn-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{l}</span>
                </button>
              ))}
            </div>

            {/* Page indicator + prev / next */}
            <div className="flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {mode !== "scroll" && (
                <ToolBtn label="Previous page" onClick={prev} disabled={!canPrev}>
                  <ChevronLeft size={18} />
                </ToolBtn>
              )}
              <span className="min-w-[7.5rem] text-center">
                Page {label} / {total}
              </span>
              {mode !== "scroll" && (
                <ToolBtn label="Next page" onClick={next} disabled={!canNext}>
                  <ChevronRight size={18} />
                </ToolBtn>
              )}
            </div>

            {/* Zoom + tools */}
            <div className="flex items-center gap-0.5">
              <ToolBtn label="Zoom out" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
                <Minus size={16} />
              </ToolBtn>
              <button
                onClick={() => setZoom(1)}
                title="Reset zoom"
                aria-label="Reset zoom"
                className="w-12 rounded-full py-1.5 text-center text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {Math.round(zoom * 100)}%
              </button>
              <ToolBtn label="Zoom in" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
                <Plus size={16} />
              </ToolBtn>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <ToolBtn label="All pages" onClick={() => setShowThumbs((s) => !s)}>
                <LayoutGrid size={16} />
              </ToolBtn>
              <span className="hidden sm:inline-flex">
                <ToolBtn label={isFs ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
                  {isFs ? <Minimize size={16} /> : <Maximize size={16} />}
                </ToolBtn>
              </span>
            </div>
          </div>
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

function ToolBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full p-2 text-foreground/80 transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
      className={`absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-background/70 p-3 backdrop-blur transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-20 sm:block ${side === "left" ? "left-3 md:left-6" : "right-3 md:right-6"}`}
    >
      {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
    </button>
  );
}
