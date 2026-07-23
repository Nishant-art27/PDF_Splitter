# Legal PDF Splitter

Rule-based segmentation of court document bundles. Upload one large searchable
PDF and it is split into one PDF per legal case, detected by configurable
classification headers (`L I R`, `CC NI ACT`, `BAIL MATTERS`, …) at the top of
a page.

No AI, no OCR, no external APIs — plain text-rule matching with open-source
libraries only.

## Stack

| Part     | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Tailwind CSS (Vite)                           |
| Backend  | Node.js + Express + TypeScript                                        |
| PDF      | `pdfjs-dist` (text extraction), `pdf-lib` (splitting)                 |
| Upload   | `multer` with in-memory storage                                       |
| ZIP      | `archiver`, streamed directly to the response                         |

## Getting started

```bash
npm install
npm run dev        # starts API on :3001 and UI on :5173 (proxied)
```

Open http://localhost:5173.

Production build:

```bash
npm run build      # compiles server to server/dist and client to client/dist
npm run start      # runs the compiled API server
```

Serve `client/dist` with any static file server (or put it behind the same
reverse proxy as `/api`).

## How splitting works

1. Every page's text is extracted with pdf.js and grouped into visual lines.
2. The top ~10 lines of each page are normalized (trimmed, whitespace
   collapsed, uppercased) and compared against the configured headers.
   A header must match as a whole-token prefix of a line, so `CA` matches
   `CA 105/23` but not `CASE STATUS REPORT`.
3. A matching page closes the previous document and starts a new one; the
   following pages belong to it until the next match.
4. The output filename is built from the header and the case number found on
   the first page: `L I R 9388/16` starting on source page 1 becomes
   `L I R 9388_16_Page_1.pdf` (invalid filename characters sanitized).
5. Pages before the first match — or a PDF where nothing can be classified —
   become `not done YYYY-MM-DD.pdf` for manual review.

**Fallback mode:** when no configured header appears anywhere in the PDF, the
app falls back to a conservative heading heuristic (short ALL-CAPS first line
of a page starts a new section) so ordinary documents can still be split.

**Extensibility:** detection is behind the `BoundaryDetector` interface
(`server/src/types.ts`); `HeaderRuleDetector` and `HeadingFallbackDetector`
(`server/src/services/boundaryDetectors.ts`) are the current implementations.
An OCR-backed or smarter detector can be added without touching the pipeline.

## Authentication

Opening the app shows a **Sign in / Sign up** page; every API route
(except auth and health) requires a signed-in session.

- **Sign up** with a display name (what you're called in the app), an
  **email address**, and a password (min 6 characters). Signing up signs
  you straight in. Emails are case-insensitive (`Jils@X.com` =
  `jils@x.com`).
- **Forgot password:** the sign-in page has a "Forgot password?" flow —
  enter your email, receive a 6-digit code, set a new password. Codes
  expire after 10 minutes, allow 5 wrong guesses, are single-use, and the
  responses never reveal whether an email is registered.
- **Email sending:** copy `server/config/smtp.example.json` to
  `server/config/smtp.json` and fill in SMTP credentials (for Gmail:
  enable 2-step verification, create an App Password). The file is
  gitignored. **Until it exists, reset codes are printed to the server
  console** so the flow can be used/tested without any mail setup.
- **Sessions last 10 minutes** (sliding — activity extends them) as an
  httpOnly cookie backed by an in-memory store. When the session ends,
  you sign in again with your email/number and password. A server
  restart signs everyone out.
- Accounts live in `server/config/users.json` with scrypt password hashes
  (Node's built-in KDF — no plaintext, no external services). The file is
  gitignored.
- After five failed login attempts for an identifier, it is blocked for a
  minute.
- Admin helper (create an account or reset a forgotten password):

  ```bash
  npm run add-user -w server -- jils@example.com Jils newpass123
  ```

- If you expose the app beyond localhost, put it behind an HTTPS reverse
  proxy and enable the `secure: true` cookie option in
  `server/src/routes/auth.ts`.

## Header configuration

Headers are **per-user**: each account has its own list, managed in the UI
(Header Settings tab) and persisted under the account's email in
`server/config/headers.json`. A user's list survives logout, session
expiry, and server restarts, and never affects other users. New accounts
start with the default header set. Writes are serialized and atomic, so
concurrent saves by different users cannot corrupt the file.

Split results are also private per user: a download session belongs to the
account that processed the PDF, and no other signed-in user can access it.

## Security / privacy behavior

- Uploads are held in memory only (multer memory storage); they are never
  written to disk and are released after processing.
- Generated PDFs live in an in-memory session that expires ~10 minutes after
  processing; an interval sweeper wipes expired sessions.
- ZIP downloads are streamed straight to the client and never stored.
- Scanned/image-only PDFs are rejected with a clear error (no OCR by design).

## API

| Method | Path                                  | Purpose                              |
| ------ | ------------------------------------- | ------------------------------------ |
| POST   | `/api/process` (multipart `file`)     | Split a PDF, returns session + files |
| GET    | `/api/sessions/:sid/files/:fid`       | Download one generated PDF           |
| GET    | `/api/sessions/:sid/zip?exclude=a,b`  | Download ZIP minus excluded file ids |
| GET    | `/api/headers`                        | Current + default headers            |
| PUT    | `/api/headers` `{ headers: string[] }`| Replace the header list              |
| GET    | `/api/health`                         | Liveness check                       |
