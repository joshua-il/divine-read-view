import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { MagazineReader } from "@/components/MagazineReader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NRIM Magazine — Read the Latest Issue" },
      { name: "description", content: "Read the Nations Reach International Missions magazine online in a smooth, page-turning reader." },
      { property: "og:title", content: "NRIM Magazine — Read the Latest Issue" },
      { property: "og:description", content: "Stories of faith and mission from Nations Reach International Missions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-5 md:px-16">
        <a href="https://nrim.org" className="font-sans text-lg font-extrabold tracking-tight">NRIM</a>
        <nav className="flex items-center gap-6">
          <span className="hidden text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground sm:inline">Magazine</span>
          <a href="https://nrim.org/donate" className="rounded-full border border-border px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:border-primary hover:text-primary">Donate</a>
        </nav>
      </header>

      <section className="px-6 pb-8 pt-14 text-center">
        <p className="font-display text-sm tracking-[0.6em] text-muted-foreground">N R I M</p>
        <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-none text-ivory md:text-7xl">The Magazine</h1>
        <div className="mt-4 flex items-center justify-center gap-5">
          <span className="h-px w-16 bg-primary/70 md:w-28" />
          <span className="font-script text-2xl italic text-ivory md:text-3xl">March 2026 Issue</span>
          <span className="h-px w-16 bg-primary/70 md:w-28" />
        </div>
      </section>

      <main className="flex-1">
        <ClientOnly fallback={<div className="py-24 text-center text-muted-foreground">Loading reader…</div>}>
          <MagazineReader />
        </ClientOnly>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs tracking-[0.2em] text-muted-foreground">
        © 2026 Nations Reach International Missions
      </footer>
    </div>
  );
}
