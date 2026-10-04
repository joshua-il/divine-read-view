# NRIM Magazine — Deployment & Administration Guide

This guide explains how to deploy the NRIM Digital Magazine to Vercel, connect it to your subdomain `magazine.nrim.org`, and manage newsletter PDF uploads using the **admin@nrim.org** account.

---

## 1. Deploying to Vercel

1. **Push your code to GitHub**:
   Ensure all changes on the `main` branch are pushed to your repository (`joshua-il/divine-read-view`).

2. **Import into Vercel**:
   - Log in to your [Vercel Dashboard](https://vercel.com).
   - Click **Add New...** → **Project**.
   - Select your GitHub repository: `joshua-il/divine-read-view`.
   - Framework Preset: **Other** (configured via `vercel.json` and Nitro).
   - Build Command: `NITRO_PRESET=vercel npm run build` (set automatically by `vercel.json`).
   - Click **Deploy**.

---

## 2. Connecting the Subdomain (`magazine.nrim.org`)

1. **Add the domain in Vercel**:
   - Go to your Project in Vercel → **Settings** → **Domains**.
   - Type `magazine.nrim.org` and click **Add**.

2. **Configure your DNS Provider** (where `nrim.org` is managed, e.g. Bluehost, Cloudflare, GoDaddy):
   - Add a new DNS record:
     | Type      | Name / Host | Target / Value         | TTL              |
     | :-------- | :---------- | :--------------------- | :--------------- |
     | **CNAME** | `magazine`  | `cname.vercel-dns.com` | Automatic / 3600 |
   - Once DNS propagates (typically 2–15 minutes), Vercel will automatically provision a free SSL certificate.
   - All links, social shares, and redirects will now resolve to `https://magazine.nrim.org`.

---

## 3. Persistent PDF Storage (Access for Everyone Everywhere)

To ensure that any newsletter PDF you upload is stored permanently in the cloud so **all visitors anywhere in the world** can access it:

### Option A: 1-Click Vercel Blob Storage (Recommended)

1. In your project dashboard on Vercel, click the **Storage** tab.
2. Click **Create Database** → Select **Blob** → Click **Continue** → **Create**.
3. Vercel automatically provisions global CDN storage and sets the `BLOB_READ_WRITE_TOKEN` environment variable.
4. Redeploy once (or let Vercel redeploy) to inject the environment variable.
5. That's it! Any PDF you upload via the Admin interface will be permanently stored on Vercel's high-speed global edge network.

### Option B: Direct PDF URL (e.g. from NRIM WordPress)

If you already upload your PDF files to your main WordPress website (`nrim.org`):

1. In the Admin Portal, switch to the **Direct URL** tab.
2. Paste the URL (e.g. `https://nrim.org/wp-content/uploads/2026/08/Copy-of-NRIM-Magazine-Feb-2026-1.pdf`).
3. Click **Publish to Live Site**.
4. The built-in proxy automatically handles any CORS restrictions so readers can turn pages seamlessly.

---

## 4. Admin Account & Publishing (`admin@nrim.org`)

### How to Sign In as Admin

- In the top toolbar of the magazine reader, click the **🔒 Admin** button.
- Or scroll to the footer and click **Admin Portal**.
- Or visit directly: `https://magazine.nrim.org/admin`.

### Access:

- **Email**: `admin@nrim.org` (strict access control).
- Use your designated NRIM admin credentials to sign in.

### Managing Your Password:

Once logged in, click the **Change Password** button in the admin bar to set a new custom password (minimum 6 characters).

### Publishing a New Issue:

1. Enter the **Title** (e.g. _The Magazine_).
2. Enter the **Edition / Month** (e.g. _March 2026 Issue_ or _April 2026 Issue_).
3. Select or upload the PDF (drag & drop or direct URL).
4. Click **Publish to Live Site**.
5. The new issue is immediately live for all readers visiting `magazine.nrim.org`.

---

## 5. Reader Features Available to All Visitors

- **Two-Page Spread Mode**: Realistic magazine experience with cover page shown alone.
- **Single Page Mode**: Focused reading for mobile devices and smaller screens.
- **Vertical Scroll Mode**: Continuous flow reading.
- **High-Resolution Vector Rendering**: Built on PDF.js canvas rendering with device pixel ratio scaling.
- **Thumbnail Grid**: Visual preview for jump-to-page navigation.
- **Zoom & Fullscreen**: Custom zoom scaling from 60% to 240%.
- **Download & Social Sharing**: Pre-formatted share links for WhatsApp, Facebook, X, and Email with page-specific link generation (`?page=N`).
