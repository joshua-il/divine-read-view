export interface MagazineIssue {
  id: string;
  title: string;
  issueName: string;
  subtitle: string;
  description: string;
  pdfUrl: string;
  fileName: string;
  fileSize?: number;
  updatedAt: string;
  updatedBy: string;
  isPublished: boolean;
}

export interface AdminSession {
  email: string;
  token: string;
  expiresAt: number;
}

export const ADMIN_EMAIL = "admin@nrim.org";

export const DEFAULT_MAGAZINE_ISSUE: MagazineIssue = {
  id: "march-2026",
  title: "The Magazine",
  issueName: "March 2026 Issue",
  subtitle: "N R I M",
  description: "Stories of faith and mission from Nations Reach International Missions.",
  pdfUrl: "/magazine.pdf",
  fileName: "NRIM-Magazine-March-2026.pdf",
  fileSize: 43232158,
  updatedAt: "2026-03-01T00:00:00.000Z",
  updatedBy: ADMIN_EMAIL,
  isPublished: true,
};
