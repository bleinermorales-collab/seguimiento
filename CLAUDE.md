# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
npm install --legacy-peer-deps  # Install deps (next-auth has a nodemailer peer conflict)
```

No test suite exists. Verify behavior by calling API routes with `node` scripts using `fetch()` — never use shell `curl` with UTF-8 strings (Spanish accented characters get corrupted in the Windows terminal).

## Architecture

Next.js 16 App Router app for tracking course virtualization at Corporación Universitaria Americana. Uses an Excel file (`data/cursos.xlsx`) as its live read/write database — no SQL or ORM.

### Production basePath

In production the app runs behind Nginx at `/seguimiento` (basePath in `next.config.ts`). This has three consequences throughout the codebase:

1. **Client-side fetch**: every `fetch('/api/...')` in a client component **must** use `fetch(api('/api/...'))` where `api()` is imported from `@/lib/api`. It prepends `NEXT_PUBLIC_BASE_PATH` (set to `/seguimiento` at build time).
2. **Middleware redirects** (`proxy.ts`): all `NextResponse.redirect()` calls use the `redir()` helper which prepends `BASE` (`/seguimiento` in prod, `''` in dev). Do not use `new URL('/path', req.url)` directly.
3. **SessionProvider** (`components/Providers.tsx`): passes `basePath="/seguimiento/api/auth"` so next-auth client functions (`signIn`, `signOut`) hit the right endpoints.
4. **signOut callbackUrl**: must use `api('/login')`, not `'/login'`.
5. **`<a href>`** tags in client components: use `href={api('/path')}`.

### Roles and routing

Five roles, each with a dedicated page. The middleware (`proxy.ts`) handles role→page routing on `/` and protects role-specific routes:

| Role | Page | What they do |
|---|---|---|
| Gestor | `/gestor` | Record content start/finish/correction |
| Diseñador Instruccional (DI) | `/di` | Approve or return courses assigned to them |
| Coordinador GC (`coordinador`) | `/coordinador` | Assign Gestores + link + create new courses |
| Coordinador DI (`kararamirez`) | `/coordinador-di` | Assign DIs + link to courses in revision |
| Super Admin (`admin`) | `/admin` | Read-only dashboard + password management + send report |

The two Coordinador users share role `'Coordinador'` in the JWT. The middleware differentiates them by email (`coordinacion_di@americana.edu.co` → `/coordinador-di`).

### State machine

Defined in `config/estados.ts`. Each `EstadoOption.updates` maps an Excel column name to a literal string or `'__TODAY__'` (replaced with `new Date()` in the API).

**Gestor transitions**: `No empezado` → `En proceso` → `En revisión` (and `Corrección` → `En revisión` after fixes)
**DI transitions**: `En revisión` → `Aprobado DI` or `Corrección`

New courses are created with estado `'No empezado'` (not `'Sin iniciar'`). Both values are treated as equivalent throughout the codebase (`isSinIniciar` checks for both).

### DI assignment flow

The Coordinador DI assigns a specific DI to each course in revision. Only courses with `DI responsable = <DI's name>` appear in that DI's `/di` view (filtered in `/api/my-courses`). This is done via `POST /api/assign-di`.

**DI page behavior**: "Iniciar revisión" executes immediately without a confirmation modal. "Aprobar" also executes immediately. Only "Devolver" shows the modal (to enter the correction reason/observations).

### Excel I/O (`lib/excel.ts` + `lib/sheets.ts`)

The xlsx package is a `serverExternalPackage` in `next.config.ts` (server-only).

Excel sheets have **merged cells** for `Programa` and `Modalidad` — `readSheet()` forward-fills these with `_programa` and `_modalidad` shadow fields.

**Critical**: `updateCourse()` must use `readSheet()` (the `sheet_to_json` path) to find the target row, then map back to the raw worksheet row as `range.s.r + 1 + logicalIdx`.

**Key normalization**: `readSheet()` applies `normalizeRowKeys()` after `sheet_to_json`, which remaps column name variants (e.g. `'Link '`, `'Enlace'`, `'Gestor responsable '`) to their canonical names using `COL_ALIASES` + `ALIAS_REVERSE`. This means all downstream code can rely on canonical names like `'Link'`, `'Gestor responsable'`, etc.

Column matching uses `normalizeColName()` (strips diacritics, lowercases, trims) and `COL_ALIASES` to handle inconsistencies like trailing spaces (`'Gestor responsable '`).

When Google Sheets credentials are configured, `lib/sheets.ts` reads from Google Sheets and writes to both Google Sheets and local Excel. `Link` and `Link DI` columns are local-only (filtered out before Google Sheets writes).

### JSON sidecar files (`data/`)

Some data that doesn't fit reliably into the Excel (columns may not exist in all sheets) is stored in JSON files:

- **`data/course-links.json`** — GC and DI coordinator links, keyed by `"nivel::programa::asignatura"` (all segments trimmed). Merged into API responses via `mergeLinksDI()` from `lib/course-links.ts`. **Critical**: `courseKey()` trims all segments; `readLinks()` also normalizes existing keys on load to fix legacy entries with trailing spaces.
- **`data/passwords.json`** — bcrypt-hashed custom passwords, keyed by username. Read by `lib/passwords.ts`. Falls back to env var (`PASS_<USERNAME>`) then default `'americana2025'`.

### Course creation (`POST /api/courses`)

Coordinador GC can create new courses directly from the platform (`/coordinador` → "Agregar curso" button). The API accepts all Excel column fields, writes to the correct sheet via `appendCourse()`, and syncs to Google Sheets when credentials are configured. New courses always get `Estado = 'No empezado'`.

`appendCourse(nivel, fields: Record<string, string | number>)` in `lib/excel.ts` / `lib/sheets.ts`:
- Finds the target sheet by nivel name
- Iterates `fields` entries, maps each to a column index via `buildHeaderMap` + `normalizeColName`
- Appends to row `range.e.r + 1` and extends `ws['!ref']`

### API routes

| Route | Purpose |
|---|---|
| `GET /api/data` | Dropdown data — `?type=gestores\|dis\|programas\|cursos&nivel=X&programa=Y` |
| `GET /api/course-info` | Current state of one course |
| `POST /api/update` | Apply a state transition |
| `POST /api/send-email` | Send notification emails |
| `GET /api/admin` | All courses across all sheets (includes merged Link DI data) |
| `GET /api/my-courses` | Role-filtered courses (Gestor: assigned to them; DI: assigned to them + En revisión) |
| `POST /api/assign` | Coordinador GC assigns Gestor + link |
| `POST /api/assign-di` | Coordinador DI assigns DI + link (writes to course-links.json) |
| `POST /api/courses` | Coordinador GC creates a new course (appends to Excel + Google Sheets) |
| `GET /api/report/approved` | Preview today's approved courses (no email) |
| `POST /api/report/approved` | Send approved-courses report email with XLSX attachment |
| `GET/POST /api/admin/passwords` | List users / change passwords (Super Admin only) |

### Approved courses report (`app/api/report/approved/route.ts`)

Triggered from the Super Admin dashboard ("Reporte aprobados" button) or via cron with `Authorization: Bearer REPORT_SECRET`.

- Filters courses with `Estado = 'Aprobado DI'` or `'Aprobado'`
- Date window: `Fecha fin revisión DI` = today or yesterday (approximates 6 PM–6 PM window since Excel stores no time). **Date comparison uses `parseDateField()`** which normalizes Date objects, Excel serials, ISO strings, and DD/MM/YYYY strings to DD/MM/YYYY before comparing.
- Groups by Posgrado/Pregrado → Proyecto
- Sends HTML email + plain-text copy block + XLSX attachment (all historical approved courses) to `coordinacion_di@americana.edu.co`
- `fromEmail` = `REPORT_FROM_EMAIL` env var (falls back to `SMTP_USER`). Required for DWD to work.
- If `count === 0`, returns early without sending

### Authentication (`lib/auth.ts` + `lib/passwords.ts`)

NextAuth v4 Credentials provider. Password check order: `data/passwords.json` (bcrypt) → env var `PASS_<USERNAME>` → default `'americana2025'`. JWT callbacks store `role` and `email` on the token. Users defined in `config/users.ts`.

### Email (`lib/email.ts`)

Three-tier send strategy: Google DWD (domain-wide delegation) → OAuth personal token → SMTP. If no credentials configured, email is silently skipped. Notification recipients per event type are in `config/notificaciones.ts`.

**DWD with attachments**: when `options.attachments` is non-empty, `sendViaDWD` builds a proper `multipart/mixed` MIME message (HTML part + base64 attachment parts) instead of a simple single-part email.

**Observation formatting**: `options.observaciones` passed to `buildEmailHtml` is split by `\n` and each line wrapped in a `<p>` tag so paragraph breaks are preserved in the email.

### Environment variables (`.env.local`)

```env
NEXTAUTH_URL=http://kora.americana.edu.co/seguimiento   # full URL including basePath
NEXTAUTH_SECRET=<random-string>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=                  # leave blank to skip SMTP
SMTP_PASS=
NEXT_PUBLIC_MY_EMAIL=
REPORT_FROM_EMAIL=          # email to impersonate for DWD report sending (e.g. coordinacion_gc@americana.edu.co)
REPORT_SECRET=              # bearer token for cron-triggered report endpoint
# Optional: Google Sheets / Gmail API
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

### Deployment

Production runs on a Linux server behind Nginx at `kora.americana.edu.co/seguimiento`. Managed by PM2:

```bash
cd /var/www/html/seguimiento
git pull && npm run build && pm2 restart seguimiento
```

The report can be scheduled via systemctl/cron:
```bash
curl -X POST https://kora.americana.edu.co/seguimiento/api/report/approved \
  -H "Authorization: Bearer $REPORT_SECRET"
```
