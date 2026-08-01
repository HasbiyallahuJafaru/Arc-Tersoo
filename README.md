# Tersoo Macikpah — In Loving Memory

A single-page tribute website for collecting and displaying memories, messages, and photos from friends, family, and loved ones. Submissions are saved to **Google Drive** (organized in folders per person) and optionally logged to a Google Sheet.

## Quick Start

### 1. Preview the Page

Open `index.html` in your browser. The page works in **demo mode** out of the box — it shows placeholder tributes and simulates form submission so you can see the full experience immediately.

### 2. Connect Google Drive (Production)

To collect real submissions and save them to Google Drive:

1. Go to **[script.google.com](https://script.google.com)** and create a new project
2. Copy the contents of [`backend/Code.gs`](backend/Code.gs) into the editor
3. Create a Google Sheet named **"Tersoo Macikpah Tributes"** in your Drive, then copy its Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/{THIS_IS_THE_SHEET_ID}/edit
   ```
4. Paste the Sheet ID into the `SHEET_ID` variable in Code.gs (line ~45)
5. Click **Deploy → New Deployment**:
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL
7. Open [`js/app.js`](js/app.js) and paste the URL into `CONFIG.backendUrl` (line ~19)

That's it! Form submissions will now create folders in Google Drive and log entries in your sheet.

### Google Drive Structure

```
Tersoo Macikpah — Tributes/          ← parent folder
├── Sarah Johnson (2026-07-28)/      ← per-submission folder
│   ├── tribute.txt                  ← full message + details
│   └── photo.jpg                    ← uploaded photo (if any)
├── Michael Oche (2026-07-27)/
│   ├── tribute.txt
│   └── photo.jpg
└── Tribute Log (Spreadsheet)        ← all entries in one sheet
```

---

## Alternative: Dropbox Integration

If you prefer Dropbox over Google Drive, set up the Dropbox API:

### Setup

1. Go to the **[Dropbox App Console](https://www.dropbox.com/developers/apps)**
2. Click **Create app**:
   - Choose: **Scoped access**
   - Choose: **App folder** (isolated folder for this app)
   - Name: `Tersoo Macikpah Tributes`
3. Under **Permissions**, enable:
   - `files.content.write`
   - `files.content.read`
4. Generate an **access token** under Settings
5. Replace `js/app.js` `CONFIG.backendUrl` with your proxy endpoint (see below)

### Important: CORS

Dropbox API doesn't support browser CORS directly. You have two options:

**Option A: Use a simple proxy** (e.g., Netlify Function, Cloudflare Worker, or Vercel Serverless):
```js
// Example: Netlify function at /api/submit-tribute
// This proxies your form POST to Dropbox API with your token
```

**Option B: Use the [Dropbox API via a backend proxy](backend/dropbox-proxy.js)**

The included [`backend/dropbox-proxy.js`](backend/dropbox-proxy.js) provides a ready-to-deploy Vercel serverless function.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page — hero, remembrance, form, tributes wall |
| `css/styles.css` | All styling — design tokens, responsive layout, animations |
| `js/app.js` | Frontend logic — validation, upload, submission, tribute display |
| `backend/Code.gs` | Google Apps Script backend (Drive + Sheets) |
| `backend/dropbox-proxy.js` | Dropbox proxy for Vercel/Netlify (alternative) |

## Customization

### Change the honoree's details

1. Replace `Tersoo Macikpah` with the person's name throughout `index.html`
2. Update the dates (line `hero__dates`)
3. Replace `assets/photo-placeholder.jpg` with an actual photo
4. Edit the remembrance text in the About section

### Change colors / fonts

All design tokens are in `css/styles.css` under the `:root` block:
```css
--color-primary: #1E3A8A;   /* Deep navy — change this */
--color-accent:  #B8860B;   /* Warm gold — change this */
--font-heading: 'Playfair Display', ...;
--font-body: 'Inter', ...;
```

### Moderate tributes before display

By default, all submissions appear immediately on the tributes wall. To require approval:

1. In the Google Sheet, add an **"Approved"** column (column H)
2. Uncomment the moderation block at the end of `backend/Code.gs`
3. Mark each row as `TRUE`/`FALSE` to control visibility

---

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (zero dependencies)
- **Backend**: Google Apps Script (free, serverless)
- **Storage**: Google Drive + Google Sheets

## Accessibility

This page targets **WCAG 2.1 AA**:
- Semantic HTML with ARIA labels
- 4.5:1+ contrast ratios
- Full keyboard navigation
- Screen-reader-friendly form labels
- `prefers-reduced-motion` support
- Responsive 375px → 1440px+

---

*Made with love. 🕯️*
