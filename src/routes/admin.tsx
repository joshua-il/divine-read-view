import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminModal } from "@/components/AdminModal";
import { DEFAULT_MAGAZINE_ISSUE, type MagazineIssue } from "@/lib/types";
import { isCurrentAdmin } from "@/lib/auth";
import { getActiveMagazine } from "@/lib/magazine-client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — NRIM Magazine" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [issue, setIssue] = useState<MagazineIssue>(DEFAULT_MAGAZINE_ISSUE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAdmin(isCurrentAdmin());
    getActiveMagazine()
      .then((active) => setIssue(active))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {loading ? (
        <div className="text-center text-sm text-muted-foreground tracking-widest uppercase">
          Loading Admin Portal…
        </div>
      ) : (
        <AdminModal
          isOpen={true}
          onClose={() => navigate({ to: "/" })}
          isAdmin={isAdmin}
          currentIssue={issue}
          onIssueUpdated={(updated) => setIssue(updated)}
          onAdminStatusChange={(status) => setIsAdmin(status)}
        />
      )}
    </div>
  );
}
