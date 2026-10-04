import { useState, useRef } from "react";
import {
  X,
  Lock,
  Unlock,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  FileText,
  Globe,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { ADMIN_EMAIL, DEFAULT_MAGAZINE_ISSUE, type MagazineIssue } from "../lib/types";
import { loginAdmin, logoutAdmin, changeAdminPassword } from "../lib/auth";
import { saveActiveMagazine } from "../lib/magazine-client";
import { savePdf } from "../lib/pdf-store";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentIssue: MagazineIssue;
  onIssueUpdated: (newIssue: MagazineIssue) => void;
  onAdminStatusChange: (status: boolean) => void;
}

export function AdminModal({
  isOpen,
  onClose,
  isAdmin,
  currentIssue,
  onIssueUpdated,
  onAdminStatusChange,
}: AdminModalProps) {
  // Login form state
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Issue editor state
  const [title, setTitle] = useState(currentIssue.title);
  const [issueName, setIssueName] = useState(currentIssue.issueName);
  const [subtitle, setSubtitle] = useState(currentIssue.subtitle);
  const [description, setDescription] = useState(currentIssue.description);
  const [pdfUrl, setPdfUrl] = useState(currentIssue.pdfUrl);
  const [fileName, setFileName] = useState(currentIssue.fileName);

  // Upload state
  const [uploadSource, setUploadSource] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Change password state
  const [showChangePass, setShowChangePass] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMessage, setPassMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const res = loginAdmin(email, password);
    if (res.success) {
      setLoginSuccess(true);
      onAdminStatusChange(true);
      setPassword("");
      setTimeout(() => setLoginSuccess(false), 2000);
    } else {
      setLoginError(res.error || "Login failed");
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    onAdminStatusChange(false);
    setStatusMessage({ type: "info", text: "Logged out successfully" });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setStatusMessage({ type: "error", text: "Please select a valid PDF file." });
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      setStatusMessage({
        type: "info",
        text: `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Click "Publish to Live Site" to upload and activate.`,
      });
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsUploading(true);

    try {
      let activePdfUrl = pdfUrl;
      let activeFileName = fileName;
      let activeFileSize = currentIssue.fileSize;

      // If a new local file was selected, save it directly
      if (uploadSource === "upload" && selectedFile) {
        setUploadProgress("Saving PDF issue...");
        await savePdf(selectedFile);
        activeFileName = selectedFile.name;
        activeFileSize = selectedFile.size;
        activePdfUrl = "";
      }

      setUploadProgress("Updating magazine issue configuration...");

      const updatedIssue: MagazineIssue = {
        ...currentIssue,
        title: title.trim() || "The Magazine",
        issueName: issueName.trim() || "Latest Issue",
        subtitle: subtitle.trim() || "N R I M",
        description: description.trim(),
        pdfUrl: activePdfUrl.trim(),
        fileName: activeFileName.trim(),
        fileSize: activeFileSize,
        updatedAt: new Date().toISOString(),
        updatedBy: ADMIN_EMAIL,
        isPublished: true,
      };

      const saveRes = await saveActiveMagazine(updatedIssue);
      onIssueUpdated(saveRes.issue);

      setStatusMessage({
        type: "success",
        text: "Magazine published successfully! All visitors to magazine.nrim.org will now see this issue.",
      });
      setSelectedFile(null);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to publish magazine issue.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleResetToDefault = () => {
    setTitle(DEFAULT_MAGAZINE_ISSUE.title);
    setIssueName(DEFAULT_MAGAZINE_ISSUE.issueName);
    setSubtitle(DEFAULT_MAGAZINE_ISSUE.subtitle);
    setDescription(DEFAULT_MAGAZINE_ISSUE.description);
    setPdfUrl(DEFAULT_MAGAZINE_ISSUE.pdfUrl);
    setFileName(DEFAULT_MAGAZINE_ISSUE.fileName);
    setSelectedFile(null);
    setStatusMessage({
      type: "info",
      text: "Reset fields to official NRIM March 2026 issue. Click 'Publish to Live Site' to save.",
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);
    const res = changeAdminPassword(oldPass, newPass);
    if (res.success) {
      setPassMessage({ type: "success", text: "Admin password updated successfully!" });
      setOldPass("");
      setNewPass("");
      setTimeout(() => setShowChangePass(false), 2000);
    } else {
      setPassMessage({ type: "error", text: res.error || "Failed to update password." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card/95 text-foreground shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
              {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                NRIM Magazine Administration
              </h2>
              <p className="text-xs text-muted-foreground tracking-wider">
                {isAdmin ? `Authorized as ${ADMIN_EMAIL}` : "Admin Sign-in & Newsletter Publisher"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isAdmin ? (
            /* Login Screen */
            <form onSubmit={handleLogin} className="space-y-5">
              {loginError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-xs text-destructive">
                  <AlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}

              {loginSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/15 p-3 text-xs text-green-400">
                  <CheckCircle2 size={16} />
                  <span>Authentication successful. Welcome, Admin!</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="admin@nrim.org"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2.5 pr-10 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full rounded-xl py-3 text-xs font-bold uppercase tracking-[0.2em] transition hover:brightness-110 flex items-center justify-center gap-2"
              >
                <Unlock size={16} />
                Sign In
              </button>
            </form>
          ) : (
            /* Admin Management Dashboard */
            <div className="space-y-6">
              {/* Admin Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 p-3.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-foreground">{ADMIN_EMAIL}</span>
                  <span className="text-muted-foreground">• Admin Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowChangePass(!showChangePass)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition"
                  >
                    <KeyRound size={13} />
                    Change Password
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition"
                  >
                    <LogOut size={13} />
                    Logout
                  </button>
                </div>
              </div>

              {/* Password Change Form (collapsible) */}
              {showChangePass && (
                <form
                  onSubmit={handleChangePassword}
                  className="rounded-xl border border-border bg-background/50 p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Update Admin Password
                  </h4>
                  {passMessage && (
                    <div
                      className={`text-xs p-2.5 rounded-lg border ${passMessage.type === "success" ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
                    >
                      {passMessage.text}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={oldPass}
                      onChange={(e) => setOldPass(e.target.value)}
                      required
                      className="rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                    <input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      required
                      className="rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChangePass(false)}
                      className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs ${
                    statusMessage.type === "success"
                      ? "border-green-500/40 bg-green-500/10 text-green-300"
                      : statusMessage.type === "error"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-primary/40 bg-primary/10 text-primary"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Main Publish Form */}
              <form onSubmit={handlePublish} className="space-y-5">
                {/* Issue Metadata */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    1. Issue Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Main Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="The Magazine"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Issue Edition / Month
                      </label>
                      <input
                        type="text"
                        value={issueName}
                        onChange={(e) => setIssueName(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="March 2026 Issue"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Organization Subtitle
                      </label>
                      <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="N R I M"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Issue File Name
                      </label>
                      <input
                        type="text"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="NRIM-Magazine-March-2026.pdf"
                      />
                    </div>
                  </div>
                </div>

                {/* PDF Source Picker */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      2. Newsletter PDF File
                    </h3>
                    <div className="flex rounded-lg border border-border p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setUploadSource("upload")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition ${uploadSource === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Upload PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadSource("url")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition ${uploadSource === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Direct URL
                      </button>
                    </div>
                  </div>

                  {uploadSource === "upload" ? (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/80 bg-background/40 p-8 text-center cursor-pointer transition hover:border-primary hover:bg-card/60"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Upload size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {selectedFile
                              ? selectedFile.name
                              : "Click or drag & drop new newsletter PDF"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedFile
                              ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload & publish`
                              : "Accepts any magazine PDF (large files supported). Saved for all visitors."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="url"
                          value={pdfUrl}
                          onChange={(e) => setPdfUrl(e.target.value)}
                          placeholder="https://nrim.org/wp-content/uploads/..."
                          className="w-full rounded-lg border border-input bg-background/70 px-3.5 py-2.5 text-xs focus:border-primary focus:outline-none"
                        />
                        <LinkIcon
                          size={15}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Direct WordPress or Vercel Blob PDF URL</span>
                        <button
                          type="button"
                          onClick={handleResetToDefault}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <RefreshCw size={11} /> Reset to Official NRIM URL
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cloud Storage Notice */}
                <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Globe size={14} className="text-primary" />
                    <span>Global Access on magazine.nrim.org</span>
                  </div>
                  <p>
                    When published, the newsletter is served across Vercel's global CDN so everyone
                    visiting <code className="text-foreground">https://magazine.nrim.org</code>{" "}
                    instantly reads this issue.
                  </p>
                </div>

                {/* Submit Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="rounded-lg border border-border px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition"
                  >
                    Reset Defaults
                  </button>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-[0.2em] transition hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        {uploadProgress || "Publishing..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        Publish to Live Site
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
