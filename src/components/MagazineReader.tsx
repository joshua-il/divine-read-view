import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus, Upload, LayoutGrid, Download } from "lucide-react";
import { savePdf, loadPdf } from "@/lib/pdf-store";

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
    return () => { cancelled = true; task?.cancel(); };
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
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <button ref={ref} onClick={onClick} className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition ${active ? "glow-ring ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}>
      <div className="h-[120px] min-w-[84px] bg-secondary">{visible && <PdfPage doc={doc} num={num} height={120} />}</div>
      <span className="text-[10px] tracking-widest text-muted-foreground">{num}</span>
    </button>
  );
}

export function MagazineReader() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spread, setSpread] = useState(0); // index of left page (0 = cover alone)
  const [zoom, setZoom] = useState(1);
  const [isWide, setIsWide] = useState(true);
  const [showThumbs, setShowThumbs] = useState(false);
  const [stageH, setStageH] = useState(700);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openBlob = useCallback(async (blob: Blob, name: string) => {
    setLoading(true); setError("");
    try {
      const pdfjs = await getPdfjs();
      const data = new Uint8Array(await blob.arrayBuffer());
      const d = await pdfjs.getDocument({ data }).promise;
      setDoc(d); setFileName(name); setSpread(0);
      setFileUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch {
      setError("That file couldn't be opened. Please upload a valid PDF.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadPdf().then((f) => f && openBlob(f.blob, f.name)).catch(() => {});
  }, [openBlob]);

  useEffect(() => {
    const measure = () => {
      setIsWide(window.innerWidth >= 900);
      const h = window.innerHeight - (document.fullscreenElement ? 120 : 260);
      setStageH(Math.max(360, h));
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => { window.removeEventListener("resize", measure); document.removeEventListener("fullscreenchange", measure); };
  }, []);

  const total = doc?.numPages ?? 0;
  // pages shown: cover alone, then pairs (2-3, 4-5 ...) on wide screens; single pages on narrow
  const pages: number[] = !doc ? [] : !isWide ? [spread + 1] : spread === 0 ? [1] : [spread, spread + 1].filter((p) => p <= total);
  const step = isWide ? 2 : 1;
  const canPrev = spread > 0;
  const canNext = isWide ? (spread === 0 ? total > 1 : spread + 2 <= total) : spread + 1 < total;
  const next = useCallback(() => canNext && setSpread((s) => (isWide && s === 0 ? 2 : s + step) - (isWide && s === 0 ? 0 : 0)), [canNext, isWide, step]);
  const prev = useCallback(() => canPrev && setSpread((s) => (isWide ? (s <= 2 ? 0 : s - 2) : s - 1)), [canPrev, isWide]);
  const goTo = (p: number) => { setSpread(isWide ? (p === 1 ? 0 : p - (p % 2)) : p - 1); setShowThumbs(false); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [next, prev]);

  // Preload neighbour pages for instant flipping
  useEffect(() => {
    if (!doc) return;
    [pages[pages.length - 1] + 1, pages[pages.length - 1] + 2, pages[0] - 1].forEach((p) => p >= 1 && p <= total && doc.getPage(p));
  }, [doc, spread]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    await openBlob(f, f.name);
    savePdf(f).catch(() => {});
  };

  const touch = useRef(0);
  const pageH = Math.round(stageH * zoom);
  const label = pages.length === 2 ? `${pages[0]}–${pages[1]}` : `${pages[0] ?? 0}`;

  return (
    <div ref={stageRef} className="bg-stage flex min-h-full flex-col">
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="min-w-0 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {fileName ? <span className="truncate">{fileName.replace(/\.pdf$/i, "")}</span> : "No issue loaded"}
        </div>
        <div className="flex items-center gap-1">
          {doc && (
            <>
              <ToolBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}><Minus size={16} /></ToolBtn>
              <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <ToolBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))}><Plus size={16} /></ToolBtn>
              <ToolBtn label="All pages" onClick={() => setShowThumbs((s) => !s)}><LayoutGrid size={16} /></ToolBtn>
              <ToolBtn label="Fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : stageRef.current?.requestFullscreen())}><Maximize size={16} /></ToolBtn>
              <a href={fileUrl} download={fileName} aria-label="Download" className="rounded-full p-2 text-foreground/80 transition hover:bg-accent hover:text-foreground"><Download size={16} /></a>
            </>
          )}
          <button onClick={() => inputRef.current?.click()} className="ml-2 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:border-primary hover:text-primary">
            <Upload size={14} /> {doc ? "Replace" : "Upload PDF"}
          </button>
        </div>
      </div>

      {showThumbs && doc && (
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-background/90 px-4 py-3">
          {Array.from({ length: total }, (_, i) => (
            <Thumb key={i} doc={doc} num={i + 1} active={pages.includes(i + 1)} onClick={() => goTo(i + 1)} />
          ))}
        </div>
      )}

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto px-4 py-8">
        {!doc ? (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
            className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center transition hover:border-primary"
          >
            <Upload className="text-primary" size={32} />
            <span className="font-display text-3xl">{loading ? "Opening magazine…" : "Upload this month's issue"}</span>
            <span className="text-sm text-muted-foreground">Drag & drop the magazine PDF here, or click to choose a file. Large files are fine — pages load one at a time.</span>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </button>
        ) : (
          <div
            key={spread}
            className="flex animate-in fade-in zoom-in-[0.98] duration-300"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - touch.current; if (d < -50) next(); if (d > 50) prev(); }}
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

        {doc && (
          <>
            <NavBtn side="left" disabled={!canPrev} onClick={prev} />
            <NavBtn side="right" disabled={!canNext} onClick={next} />
          </>
        )}
      </div>

      {doc && (
        <div className="flex items-center justify-center gap-4 pb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>Page {label} of {total}</span>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="rounded-full p-2 text-foreground/80 transition hover:bg-accent hover:text-foreground">
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
