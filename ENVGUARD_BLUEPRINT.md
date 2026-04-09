# EnvGuard — Complete System Blueprint
> **Role:** Senior Staff Engineer + Product Manager  
> **Purpose:** End-to-end implementation guide. Every section is written for an engineer who starts building today.  
> **Architecture Philosophy:** Zero-secrets. Schema-only. Developer-first.

---

## Table of Contents
1. [Product Requirements Document (PRD)](#1-product-requirements-document)
2. [Technical Requirements Document (TRD)](#2-technical-requirements-document)
3. [System Architecture](#3-system-architecture)
4. [CLI Design](#4-cli-design)
5. [Frontend Dashboard Design](#5-frontend-dashboard-design)
6. [Feature Breakdown — MVP to Advanced](#6-feature-breakdown)
7. [Development Phases](#7-development-phases)
8. [Tech Stack Justification](#8-tech-stack-justification)
9. [Deployment Strategy](#9-deployment-strategy)
10. [Resume & Portfolio Positioning](#10-resume--portfolio-positioning)
11. [Bonus — Making EnvGuard 10x Better](#11-bonus--10x-ideas)

---

## 1. Product Requirements Document

### 1.1 Problem Statement

Every software team shares environment variables badly. The current workflow looks like this:

- A developer creates a `.env` file locally with 12 variables.
- `.env` is gitignored (correctly), so it's never committed.
- A new teammate joins. They copy a `.env.example` that was last updated 6 months ago and is missing 4 critical variables.
- Variables get shared over Slack DMs, in plaintext, with no description of what they're for.
- Production has 3 additional variables that dev doesn't. Nobody notices until a production deploy fails at 2am.
- There's no audit trail. Nobody knows who added `STRIPE_WEBHOOK_SECRET` or when.

**The core insight:** teams don't need to sync the *values* of environment variables — they need to sync the *shape* (schema) of them. EnvGuard solves exactly this, and nothing else.

---

### 1.2 Target Users

| Segment | Description | Pain Point |
|---|---|---|
| **Solo developers** | Freelancers or indie hackers managing multiple projects | Forgetting which vars a project needs after months away |
| **Small teams (2–10)** | Startups, bootcamp teams, university project groups | Onboarding new devs, drift between dev/staging/prod |
| **Open source maintainers** | Projects with contributors who need env setup | New contributors wasting hours on env setup |
| **Internship/placement candidates** | CS students building portfolio projects | Wanting to show professional-grade workflow tooling |

---

### 1.3 Core Use Cases & Workflows

**UC-01: New developer onboarding**
```
1. Dev clones the repo
2. Runs `envguard pull`
3. EnvGuard fetches the schema for this project from the cloud
4. Outputs a checklist: "You need 9 variables. Here's what each one is for."
5. Generates a pre-filled `.env.example` with descriptions and types
6. Dev fills in the actual values themselves — EnvGuard never sees them
```

**UC-02: Developer adds a new env variable**
```
1. Dev adds NEW_API_KEY=abc123 to their local .env
2. Runs `envguard push`
3. CLI reads .env, extracts only the KEY NAME + metadata (not value)
4. Prompts: "Describe NEW_API_KEY:" → "API key for the payment gateway"
5. Prompts: "Type: string | url | boolean | number | enum" → string
6. Prompts: "Required in: dev, staging, prod?" → all
7. Schema is pushed to EnvGuard cloud. Team members are notified.
```

**UC-03: Drift detection**
```
1. Dev runs `envguard status`
2. CLI compares local .env key names against the team schema
3. Output: "⚠ 2 variables in team schema not found in your local .env: REDIS_URL, SENTRY_DSN"
4. Dashboard shows a diff view: production has 3 vars that staging doesn't
```

**UC-04: Audit review**
```
1. Production breaks after a deploy
2. Team lead opens the EnvGuard dashboard
3. Audit log shows: "ahmed added DATABASE_URL to prod schema 2 days ago"
4. Cross-referenced with the broken deploy timestamp — root cause found
```

---

### 1.4 Functional Requirements (Must-Have)

**FR-01 — CLI Tool**
- `envguard init` — links a local project to an EnvGuard project
- `envguard push` — reads local `.env`, extracts key names + metadata, pushes schema
- `envguard pull` — fetches team schema, generates `.env.example`
- `envguard status` — compares local `.env` keys against team schema, shows drift
- `envguard diff [env1] [env2]` — shows diff between two environment schemas (e.g. dev vs prod)

**FR-02 — Web Dashboard**
- Project overview page with all environments
- Environment comparison view (side-by-side variable lists)
- Drift alerts per environment
- Audit log with actor, action, timestamp, and variable name
- Team member management (invite by email, assign roles)
- `.env.example` download/copy button per environment

**FR-03 — Schema Model**
- Each variable has: `key`, `type`, `description`, `required`, `environment`, `default_hint` (optional non-secret placeholder like `"your-stripe-key-here"`)
- Types: `string`, `url`, `port`, `boolean`, `number`, `enum`, `secret` (all secret type vars are flagged specially in UI — never even hinted)

**FR-04 — Authentication**
- GitHub OAuth for web dashboard login
- CLI authenticates via a personal access token (PAT) generated from the dashboard
- PAT stored in OS keychain via `keytar` npm package (not in plaintext files)

**FR-05 — Real-time Drift Alerts**
- WebSocket connection in dashboard for live drift notifications
- Slack webhook integration for team alerts

**FR-06 — Audit Log**
- Every schema mutation (add/remove/update variable) recorded with: actor user ID, timestamp, project ID, environment, variable key, change type

---

### 1.5 Non-Functional Requirements

| Requirement | Target |
|---|---|
| **CLI response time** | `envguard push` completes in < 2 seconds for up to 100 variables |
| **API response time** | p95 < 300ms for all read endpoints |
| **Security** | Variable values NEVER touch EnvGuard servers — enforced at the CLI layer |
| **Availability** | 99.5% uptime for the API (acceptable for a free-tier project) |
| **Data integrity** | Schema mutations are atomic — partial pushes are rolled back |
| **Auditability** | 100% of schema mutations must be logged — no silent changes |
| **Portability** | CLI works on macOS, Linux, Windows (WSL2 minimum) |

---

### 1.6 Constraints

- **Zero-secrets constraint (HARD):** The CLI must strip all values before any network call. The hash of a value must never be transmitted either — only key names and metadata.
- **No vendor lock-in for the team:** The generated `.env.example` must be a plain, readable file that works without EnvGuard installed.
- **Offline-first CLI:** `envguard status` must work offline (comparing local `.env` against a locally-cached schema snapshot).

---

## 2. Technical Requirements Document

### 2.1 Security Model — How Secrets Are Never Stored

This is the architectural foundation of EnvGuard. It must be implemented correctly and audited carefully.

**At the CLI layer (the only place .env is read):**

```javascript
// pseudocode — cli/src/parser.js
function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');

  return lines
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const eqIndex = line.indexOf('=');
      const key = line.substring(0, eqIndex).trim();
      // VALUE IS INTENTIONALLY DISCARDED HERE
      // No hash, no truncation, no nothing
      return { key };
    });
}
```

**What gets transmitted (and nothing else):**
```json
{
  "projectId": "proj_abc123",
  "environment": "development",
  "variables": [
    {
      "key": "DATABASE_URL",
      "type": "url",
      "description": "PostgreSQL connection string",
      "required": true,
      "defaultHint": "postgres://user:pass@localhost:5432/mydb"
    }
  ]
}
```

**What is NEVER transmitted:**
- The value of any variable
- Any hash or digest of any value
- Any substring of any value

**Enforcement mechanism:** CLI source code is open-source. Any developer can verify that values are stripped before the HTTP call is made. This is the social contract that makes EnvGuard trustworthy.

---

### 2.2 Data Flow: CLI → Backend → Dashboard

```
LOCAL MACHINE                    ENVGUARD CLOUD                   BROWSER
─────────────────                ────────────────────             ──────────────────

.env file (with values)
    │
    ▼
CLI parser
[strips all values]
    │
    ▼
Schema payload                ──────────────────────►  POST /api/schema/push
(keys + metadata only)                                      │
                                                            ▼
                                                    Validate schema payload
                                                    (reject if value-like data detected)
                                                            │
                                                            ▼
                                                    Write to PostgreSQL
                                                    (schema_variables table)
                                                            │
                                                            ▼
                                                    Append to audit_log table
                                                            │
                                                            ▼
                                                    Broadcast via WebSocket
                                                    to connected dashboard clients
                                                                        │
                                                                        ▼
                                                                Dashboard updates
                                                                drift status live
```

---

### 2.3 Failure Scenarios & Edge Cases

| Scenario | Handling |
|---|---|
| `.env` file not found during `push` | CLI exits with `ERR_NO_ENV_FILE` and suggests running `touch .env` |
| Partial push fails mid-way | Backend wraps all DB writes in a transaction — either all succeed or none do |
| CLI token expired | CLI detects 401, prompts user to re-authenticate, offers to open browser |
| Two devs push schema simultaneously | Last-write-wins with optimistic locking — version number incremented, stale push rejected with `ERR_SCHEMA_CONFLICT` |
| Variable description contains what looks like a secret (e.g. includes `=` or long random string) | Backend validation flags this and returns a warning (but doesn't block) |
| `.env` has duplicate keys | CLI warns and uses the last occurrence (matching Node's dotenv behavior) |
| Network unavailable during `push` | CLI queues the push locally in `.envguard/pending.json` and retries on next command |
| User pushes an empty schema (deleted all vars) | CLI requires explicit `--allow-empty` flag to prevent accidental wipes |

---

### 2.4 Scalability Considerations

- **Projects:** PostgreSQL with proper indexing handles tens of thousands of projects trivially.
- **WebSocket connections:** Use Socket.io with Redis adapter for horizontal scaling (multiple API instances share WebSocket state via Redis pub/sub).
- **Schema payload size:** A project with 100 variables produces a ~10KB JSON payload. No compression needed at this scale.
- **Rate limiting:** 60 requests/minute per token for push/pull, 600/minute for read-only endpoints.

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPER MACHINE                         │
│                                                                  │
│  ┌──────────────┐    reads    ┌──────────┐                      │
│  │  .env file   │ ──────────► │  CLI     │                      │
│  │  (with vals) │             │  tool    │                      │
│  └──────────────┘             └────┬─────┘                      │
│                                    │  schema only (no values)   │
│  ┌──────────────┐    writes   ┌────▼─────┐                      │
│  │ .env.example │ ◄────────── │  Local   │                      │
│  │ (generated)  │             │  cache   │                      │
│  └──────────────┘             │ .envguard│                      │
│                               └────┬─────┘                      │
└────────────────────────────────────┼───────────────────────────┘
                                     │  HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ENVGUARD BACKEND                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Express API Server                     │    │
│  │                                                          │    │
│  │  /auth        /projects    /schema      /team    /ws     │    │
│  └──────┬───────────┬────────────┬──────────┬────────┬─────┘    │
│         │           │            │          │        │           │
│  ┌──────▼─────┐ ┌───▼────┐  ┌───▼────┐  ┌──▼───┐ ┌─▼──────┐   │
│  │  GitHub    │ │Project │  │Schema  │  │ Team │ │Socket  │   │
│  │  OAuth     │ │Service │  │Service │  │ Svc  │ │  .io   │   │
│  └──────┬─────┘ └───┬────┘  └───┬────┘  └──┬───┘ └─┬──────┘   │
│         └───────────┴───────────┴──────────┴────────┘           │
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────┐    │
│  │                      PostgreSQL                          │    │
│  │  users │ projects │ environments │ schema_variables      │    │
│  │  team_members │ audit_log │ tokens                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                               │                                  │
│  ┌────────────────────────────▼────────────────────────────┐    │
│  │                  Redis (optional for scale)               │    │
│  │  WebSocket rooms │ Rate limiting │ Schema cache           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REACT DASHBOARD                             │
│                                                                  │
│  ProjectsPage → ProjectDetail → EnvironmentDiff → AuditLog      │
│                                                                  │
│  WebSocket client (live drift updates)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Component Breakdown

#### CLI Tool (Node.js)

```
envguard-cli/
├── bin/
│   └── envguard.js          # Entry point, registers commands
├── src/
│   ├── commands/
│   │   ├── init.js          # envguard init
│   │   ├── push.js          # envguard push
│   │   ├── pull.js          # envguard pull
│   │   ├── status.js        # envguard status
│   │   └── diff.js          # envguard diff [env1] [env2]
│   ├── lib/
│   │   ├── parser.js        # .env file parser (strips values)
│   │   ├── api-client.js    # HTTP client for backend
│   │   ├── auth.js          # PAT token management via keytar
│   │   ├── config.js        # Reads/writes .envguard/config.json
│   │   ├── cache.js         # Local schema cache (.envguard/schema.json)
│   │   └── validator.js     # Validates schema payload before sending
│   └── utils/
│       ├── logger.js        # Chalk-colored terminal output
│       └── prompts.js       # Interactive prompts via inquirer
├── package.json
└── README.md
```

#### Backend API (Node/Express)

```
envguard-api/
├── src/
│   ├── routes/
│   │   ├── auth.js          # GitHub OAuth routes
│   │   ├── projects.js      # CRUD for projects
│   │   ├── schema.js        # Push/pull/diff schema
│   │   ├── team.js          # Team member management
│   │   └── audit.js         # Audit log queries
│   ├── services/
│   │   ├── schema.service.js
│   │   ├── drift.service.js  # Drift computation logic
│   │   ├── notify.service.js # Slack webhook dispatch
│   │   └── audit.service.js
│   ├── middleware/
│   │   ├── auth.middleware.js     # Validates session or PAT token
│   │   ├── rateLimit.middleware.js
│   │   └── sanitize.middleware.js # Strips any value-like data from payloads
│   ├── db/
│   │   ├── index.js         # pg Pool setup
│   │   └── migrations/      # SQL migration files
│   ├── sockets/
│   │   └── drift.socket.js  # Socket.io event handlers
│   └── app.js
├── package.json
└── .env.example             # dogfooding — EnvGuard uses EnvGuard
```

#### Frontend Dashboard (React + TypeScript)

```
envguard-web/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx         # Project list
│   │   ├── ProjectDetail.tsx     # Single project view
│   │   ├── EnvironmentDiff.tsx   # Side-by-side env comparison
│   │   ├── AuditLog.tsx          # Filterable audit trail
│   │   └── Settings.tsx          # Team, tokens, integrations
│   ├── components/
│   │   ├── VariableTable.tsx     # Reusable var list with drift badges
│   │   ├── DriftAlert.tsx        # Alert banner for missing vars
│   │   ├── EnvSelector.tsx       # Dropdown to select environment
│   │   ├── AuditEntry.tsx        # Single audit log row
│   │   └── TokenManager.tsx      # Create/revoke PAT tokens
│   ├── hooks/
│   │   ├── useSchema.ts          # Fetch + cache schema data
│   │   ├── useDrift.ts           # WebSocket drift subscription
│   │   └── useAudit.ts           # Audit log pagination
│   ├── lib/
│   │   ├── api.ts                # Axios instance with auth headers
│   │   └── socket.ts             # Socket.io client setup
│   └── App.tsx
```

---

### 3.3 Database Schema (PostgreSQL)

```sql
-- Users (populated via GitHub OAuth)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id     VARCHAR(64) UNIQUE NOT NULL,
  username      VARCHAR(128) NOT NULL,
  email         VARCHAR(256),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (one per repository or logical app)
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(256) NOT NULL,
  slug          VARCHAR(256) UNIQUE NOT NULL,  -- used in CLI config
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  github_repo   VARCHAR(512),                  -- optional repo link
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Environments (dev, staging, prod, or custom)
CREATE TABLE environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(128) NOT NULL,          -- "development", "production", etc.
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Schema Variables (the core table — NEVER stores values)
CREATE TABLE schema_variables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
  key           VARCHAR(512) NOT NULL,          -- e.g. "DATABASE_URL"
  type          VARCHAR(32) NOT NULL DEFAULT 'string',
                -- ENUM: string | url | port | boolean | number | enum | secret
  description   TEXT,
  required      BOOLEAN NOT NULL DEFAULT true,
  default_hint  TEXT,                           -- e.g. "your-api-key-here"
  enum_values   TEXT[],                         -- only populated when type = 'enum'
  created_by    UUID REFERENCES users(id),
  updated_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(environment_id, key)
);

-- Audit Log (append-only — NEVER delete rows)
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(64) NOT NULL,
                -- ENUM: var_added | var_removed | var_updated | env_created | member_added | token_created
  variable_key  VARCHAR(512),                   -- null for non-variable actions
  metadata      JSONB,                          -- before/after diff for updates
  source        VARCHAR(32) DEFAULT 'cli',      -- 'cli' | 'dashboard' | 'api'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(32) NOT NULL DEFAULT 'member',
                -- ENUM: owner | admin | member | viewer
  invited_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- CLI Authentication Tokens (PAT)
CREATE TABLE tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(256) NOT NULL,           -- "My MacBook", "CI/CD Pipeline"
  token_hash    VARCHAR(512) NOT NULL UNIQUE,    -- bcrypt hash of the token
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                     -- null = no expiry
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schema_variables_env_id ON schema_variables(environment_id);
CREATE INDEX idx_audit_log_project_id ON audit_log(project_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_team_members_project_id ON team_members(project_id);
```

---

### 3.4 API Design

#### Authentication
All protected routes require one of:
- `Cookie: session=<session_token>` — for dashboard (set after GitHub OAuth)
- `Authorization: Bearer <PAT>` — for CLI

---

#### Auth Routes
```
GET  /auth/github              → Redirects to GitHub OAuth
GET  /auth/github/callback     → Handles OAuth callback, sets session cookie
POST /auth/logout              → Clears session
GET  /auth/me                  → Returns current user object
```

---

#### Project Routes
```
GET    /api/projects                  → List all projects for current user
POST   /api/projects                  → Create project
       Body: { name, githubRepo? }
       Response: { id, name, slug, ... }

GET    /api/projects/:slug            → Get project details + environments
DELETE /api/projects/:slug            → Delete project (owner only)
```

---

#### Schema Routes (core)
```
POST   /api/schema/push
       Headers: Authorization: Bearer <PAT>
       Body: {
         projectSlug: "my-app",
         environment: "development",
         variables: [
           {
             key: "DATABASE_URL",
             type: "url",
             description: "PostgreSQL connection string",
             required: true,
             defaultHint: "postgres://user:pass@localhost:5432/mydb"
           }
         ]
       }
       Response: { syncedCount: 12, added: 2, removed: 0, updated: 1 }

GET    /api/schema/pull
       Query: ?projectSlug=my-app&environment=development
       Headers: Authorization: Bearer <PAT>
       Response: {
         environment: "development",
         variables: [ { key, type, description, required, defaultHint } ],
         lastSyncedAt: "2025-01-15T10:30:00Z"
       }

GET    /api/schema/diff
       Query: ?projectSlug=my-app&env1=development&env2=production
       Response: {
         onlyInEnv1: [ { key, ... } ],
         onlyInEnv2: [ { key, ... } ],
         inBoth: [ { key, env1: { ... }, env2: { ... }, isDifferent: bool } ]
       }

GET    /api/schema/status
       Query: ?projectSlug=my-app&environment=development
       Headers: Authorization: Bearer <PAT>
       Body: { localKeys: ["DATABASE_URL", "PORT", ...] }
       Response: {
         missing: ["REDIS_URL", "SENTRY_DSN"],
         extra: ["LEGACY_KEY"],
         synced: ["DATABASE_URL", "PORT"]
       }
```

---

#### Audit Routes
```
GET    /api/audit
       Query: ?projectSlug=my-app&environment=dev&limit=50&offset=0&action=var_added
       Response: { entries: [...], total: 142 }
```

---

#### Team Routes
```
POST   /api/team/invite
       Body: { projectSlug, email, role }

DELETE /api/team/:projectSlug/:userId   → Remove team member

PATCH  /api/team/:projectSlug/:userId   → Update role
       Body: { role: "admin" }
```

---

#### Token Routes (PAT management)
```
GET    /api/tokens                      → List all tokens for current user
POST   /api/tokens                      → Create new PAT
       Body: { name, expiresIn? }       → expiresIn in days, null = no expiry
       Response: { token: "eg_live_...", id, name }
       ⚠ Token value returned ONLY once — never again

DELETE /api/tokens/:id                  → Revoke token
```

---

### 3.5 GitHub OAuth Flow

```
1. User clicks "Sign in with GitHub" on dashboard

2. Browser → GET /auth/github
   Server redirects to:
   https://github.com/login/oauth/authorize
     ?client_id=CLIENT_ID
     &redirect_uri=https://envguard.dev/auth/github/callback
     &scope=read:user,user:email

3. User authorizes on GitHub

4. GitHub → GET /auth/github/callback?code=TEMP_CODE
   Server:
     a. POST https://github.com/login/oauth/access_token (exchange code for token)
     b. GET https://api.github.com/user (fetch profile)
     c. Upsert user in DB (create if new, update if returning)
     d. Create server-side session (express-session + connect-pg-simple)
     e. Set HttpOnly, Secure, SameSite=Strict session cookie
     f. Redirect to /dashboard

5. All subsequent API requests include the session cookie automatically
```

---

## 4. CLI Design

### 4.1 File Structure Generated

After `envguard init`, the project gains:
```
your-project/
├── .envguard/
│   ├── config.json       # Project slug, default environment
│   └── schema.json       # Local cache of last-pulled schema
├── .env                  # Unchanged — your actual secrets
├── .env.example          # Auto-generated by envguard pull
└── .gitignore            # envguard adds .env to this if missing
```

`.envguard/config.json`:
```json
{
  "projectSlug": "my-app",
  "defaultEnvironment": "development",
  "apiUrl": "https://api.envguard.dev",
  "version": 1
}
```

`.envguard/schema.json` (local cache):
```json
{
  "environment": "development",
  "syncedAt": "2025-01-15T10:30:00Z",
  "variables": [
    {
      "key": "DATABASE_URL",
      "type": "url",
      "description": "PostgreSQL connection string",
      "required": true,
      "defaultHint": "postgres://user:pass@localhost:5432/mydb"
    }
  ]
}
```

---

### 4.2 Full CLI Command Reference

#### `envguard init`

**Purpose:** Link the current directory to an EnvGuard project.

**Flow:**
```
$ envguard init

  ✦ EnvGuard — Environment Schema Manager

  ? How would you like to connect this project?
    ❯ Create a new EnvGuard project
      Link to an existing project

  ? Project name: my-awesome-app
  ? Default environment: development

  ✔ Created project "my-awesome-app" (slug: my-awesome-app)
  ✔ Created .envguard/config.json
  ✔ Added .envguard/ to .gitignore

  Next steps:
    Run `envguard push` to upload your current .env schema
    Run `envguard pull` to generate a .env.example
```

**If not authenticated:**
```
  ✖ Not authenticated. Run `envguard auth login` first.
    Opening browser... → https://envguard.dev/cli-auth
```

**`envguard auth login` flow:**
```
$ envguard auth login

  Opening https://envguard.dev/cli-auth in your browser...
  Waiting for authentication...

  ✔ Authenticated as @yourname
  ✔ Token stored securely in system keychain
```

---

#### `envguard push`

**Purpose:** Read local `.env`, strip values, annotate keys interactively, push schema.

**Flags:**
- `--env <name>` — specify environment (default: from config.json)
- `--file <path>` — specify custom .env path (default: `.env`)
- `--no-interactive` — skip prompts, push with existing/inferred metadata only
- `--allow-empty` — required flag if pushing zero variables (safety mechanism)

**Flow (interactive):**
```
$ envguard push

  ✦ Reading .env (14 variables found)
  ✦ Comparing with team schema...

  Changes detected:
    + NEW_VARIABLE      (not in team schema)
    ~ PORT              (description changed locally)
    - OLD_VARIABLE      (in team schema, not in your .env)

  ? Describe NEW_VARIABLE: API key for the SendGrid email service
  ? Type for NEW_VARIABLE:
    ❯ string
      url
      boolean
      number
      port
      enum
      secret
  ? Required in this environment? Yes

  ⚠ OLD_VARIABLE is in the team schema but not in your .env.
  ? Remove it from the team schema? (y/N) n

  ✔ Pushed schema (1 added, 1 updated, 0 removed)
  ✔ Audit log updated
  ✔ Team notified via WebSocket
```

**Flow (non-interactive / CI):**
```
$ envguard push --no-interactive --env production

  ✔ Pushed schema (0 changes — already in sync)
```

---

#### `envguard pull`

**Purpose:** Fetch team schema and generate a `.env.example` file.

**Flags:**
- `--env <name>` — specify environment
- `--output <path>` — where to write `.env.example` (default: project root)
- `--format checklist` — outputs a human-readable checklist instead of a file

**Flow:**
```
$ envguard pull

  ✦ Fetching schema for "my-awesome-app" (development)...
  ✔ 14 variables retrieved

  Generated .env.example:

  ─────────────────────────────────────────────
  # Auto-generated by EnvGuard — do not edit manually
  # Last synced: 2025-01-15 10:30 UTC

  # PostgreSQL connection string
  # Type: url | Required: yes
  DATABASE_URL=postgres://user:pass@localhost:5432/mydb

  # API key for the SendGrid email service
  # Type: secret | Required: yes
  SENDGRID_API_KEY=

  # Port the server listens on
  # Type: port | Required: yes | Default: 3000
  PORT=3000
  ─────────────────────────────────────────────

  ✔ Written to .env.example
  ✔ Schema cached to .envguard/schema.json
```

**Checklist format:**
```
$ envguard pull --format checklist

  Setup checklist for "my-awesome-app" (development):

  [ ] DATABASE_URL        — PostgreSQL connection string (url)
  [ ] SENDGRID_API_KEY    — SendGrid API key (secret)
  [✔] PORT                — Server port (port, default: 3000)
```

---

#### `envguard status`

**Purpose:** Compare local `.env` keys against team schema. Works offline using cached schema.

**Flow:**
```
$ envguard status

  ✦ Comparing local .env against team schema (development)
    Using cached schema from 2 hours ago • run `envguard pull` to refresh

  Status: ⚠ 2 issues found

  MISSING from your .env (in team schema):
    ✖ REDIS_URL           — Redis connection URL (url, required)
    ✖ SENTRY_DSN          — Sentry error tracking DSN (url, required)

  EXTRA in your .env (not in team schema):
    ? LEGACY_DB_URL       — Not in team schema. Run `envguard push` to add it.

  IN SYNC (11 variables):
    ✔ DATABASE_URL
    ✔ PORT
    ... (9 more)
```

**Exit codes:**
- `0` — fully in sync
- `1` — missing variables found (useful for CI pre-flight checks)
- `2` — auth or config error

---

#### `envguard diff`

**Purpose:** Compare two environments within the same project.

**Flow:**
```
$ envguard diff development production

  ✦ Diff: development ↔ production

  ONLY IN development (2):
    - DEBUG_MODE          boolean
    - LOCAL_MOCK_API      url

  ONLY IN production (3):
    + REDIS_URL           url
    + CDN_BASE_URL        url
    + DATADOG_API_KEY     secret

  DIFFERENT (1):
    ~ DATABASE_URL
        dev:  "PostgreSQL local connection string"
        prod: "PostgreSQL production connection string (RDS)"

  SAME (10 variables)
```

---

## 5. Frontend Dashboard Design

### 5.1 Pages & Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `LandingPage` | Marketing + GitHub OAuth sign in |
| `/dashboard` | `Dashboard` | All projects list |
| `/projects/:slug` | `ProjectDetail` | Environments + variable list |
| `/projects/:slug/diff` | `EnvironmentDiff` | Side-by-side env comparison |
| `/projects/:slug/audit` | `AuditLog` | Full filterable audit trail |
| `/settings` | `Settings` | Profile, tokens, integrations |

---

### 5.2 Page Layouts

#### Dashboard (`/dashboard`)
```
┌──────────────────────────────────────────────────────┐
│  EnvGuard          [+ New Project]           @user ▼ │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Your Projects                                       │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │ my-awesome-app     │  │ client-portal      │     │
│  │ 3 environments     │  │ 2 environments     │     │
│  │ ⚠ 2 drift alerts  │  │ ✔ All in sync      │     │
│  │ Last sync: 2h ago  │  │ Last sync: 1d ago  │     │
│  └────────────────────┘  └────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Project Detail (`/projects/:slug`)
```
┌──────────────────────────────────────────────────────┐
│  ← Dashboard   my-awesome-app                        │
│                [Compare Envs] [View Audit] [Settings]│
├──────────────────────────────────────────────────────┤
│                                                      │
│  Environments: [development ▼]                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⚠ Drift Alert                                │   │
│  │ 2 variables in schema not found in your .env │   │
│  │ Run: envguard pull                    [Copy] │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Variables (14)          [+ Add Variable] [Export]   │
│                                                      │
│  KEY              TYPE    REQUIRED  DESCRIPTION       │
│  DATABASE_URL     url     ✔         PostgreSQL conn   │
│  SENDGRID_API_KEY secret  ✔         Email service key │
│  PORT             port    ✔         Server port       │
│  DEBUG_MODE       boolean ✗         Enable debug logs │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Environment Diff (`/projects/:slug/diff`)
```
┌──────────────────────────────────────────────────────┐
│  my-awesome-app › Compare Environments               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [development ▼]          [production ▼]             │
│                                                      │
│  VARIABLE             DEV        PROD    STATUS      │
│  DATABASE_URL         url        url     ✔ same      │
│  DEBUG_MODE           boolean    —       ⚠ only dev  │
│  REDIS_URL            —          url     ⚠ only prod │
│  PORT                 port       port    ~ different  │
│                       "dev port" "prod port"         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Audit Log (`/projects/:slug/audit`)
```
┌──────────────────────────────────────────────────────┐
│  my-awesome-app › Audit Log                          │
├──────────────────────────────────────────────────────┤
│  Filter: [All Actions ▼]  [All Envs ▼]  [Search...]  │
├──────────────────────────────────────────────────────┤
│  Jan 15, 10:32 AM                                    │
│  @ahmed added REDIS_URL to production  [cli]         │
│                                                      │
│  Jan 14, 3:15 PM                                     │
│  @sara removed OLD_TOKEN from development  [dashboard]│
│                                                      │
│  Jan 13, 11:00 AM                                    │
│  @ahmed updated DATABASE_URL description  [cli]      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 5.3 React Component Structure

```tsx
// src/components/VariableTable.tsx
interface Variable {
  key: string;
  type: VariableType;
  description: string;
  required: boolean;
  defaultHint?: string;
  driftStatus?: 'synced' | 'missing' | 'extra';
}

export function VariableTable({ variables, onEdit, onDelete }: {
  variables: Variable[];
  onEdit?: (v: Variable) => void;
  onDelete?: (key: string) => void;
}) { ... }

// src/components/DriftAlert.tsx
export function DriftAlert({ missingCount, projectSlug }: {
  missingCount: number;
  projectSlug: string;
}) { ... }

// src/hooks/useDrift.ts
export function useDrift(projectSlug: string) {
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:project', projectSlug);
    socket.on('drift:update', (event: DriftEvent) => {
      setDriftEvents(prev => [event, ...prev]);
    });
    return () => { socket.emit('leave:project', projectSlug); };
  }, [projectSlug]);

  return { driftEvents };
}
```

---

### 5.4 UX Flows

**Onboarding (first-time user):**
```
Landing page → GitHub OAuth → Redirect to /dashboard →
Empty state with "Create your first project" CTA →
Project creation form → Success: show CLI install instructions:

  npm install -g envguard
  cd your-project && envguard init --slug my-awesome-app
```

**Resolving drift:**
```
Dashboard shows ⚠ badge on project →
User clicks project → Drift alert banner at top →
Banner shows exactly which variables are missing →
One-click copy of `envguard pull` command →
After pull runs, WebSocket pushes "drift resolved" event →
Alert banner disappears in real-time
```

---

## 6. Feature Breakdown

### MVP (Ship This First)

| Feature | Description | Complexity |
|---|---|---|
| GitHub OAuth | Login via GitHub, session management | Low |
| Project creation | Create/delete projects via dashboard | Low |
| `envguard init` | Link local project to EnvGuard | Low |
| `envguard push` | Push schema (non-interactive) | Medium |
| `envguard pull` | Fetch schema, generate `.env.example` | Medium |
| `envguard status` | Local drift detection (offline) | Medium |
| Variable CRUD | Add/edit/delete variables in dashboard | Medium |
| `.env.example` generation | Auto-generated file with descriptions | Low |
| Basic audit log | Record all schema mutations | Medium |
| PAT tokens | CLI authentication via personal access tokens | Medium |

---

### Advanced (Post-MVP)

| Feature | Description | Complexity |
|---|---|---|
| Real-time drift alerts | WebSocket push when schema changes | High |
| Slack/Discord integration | Webhook alerts on drift | Medium |
| `envguard diff` | Cross-environment comparison CLI + UI | Medium |
| Team invitations | Invite by email, role management | Medium |
| Schema version history | Roll back schema to any point in time | High |
| GitHub PR check | Post drift report as PR comment | High |
| Variable dependency graph | Show which vars depend on each other | High |
| `.envrc` support | Integration with direnv | Low |
| Docker env support | Parse `docker-compose.yml` for env vars | Medium |
| CI/CD integration | `envguard status --exit-code 1` for pipelines | Low |

---

## 7. Development Phases

### Phase 1: CLI MVP (Week 1–2)

**What to build:**
- Set up monorepo with `envguard-cli/` package
- Implement `.env` parser that strips values
- `envguard init` — creates `.envguard/config.json`
- `envguard auth login` — opens browser, waits for PAT, stores in keychain via `keytar`
- `envguard push --no-interactive` — pushes schema to a local mock server (JSON file for now)
- `envguard status` — offline mode only, compares local `.env` against cached `schema.json`

**Key challenges:**
- `keytar` native bindings may fail on some Linux distros — have a fallback to a plaintext file with a warning
- Stripping values correctly when `.env` has edge cases (multiline values, quoted values, `export` prefix)

**Expected outcome:** A working CLI that a developer can use entirely offline without a backend.

**Key packages:**
```json
{
  "commander": "^11.0.0",
  "inquirer": "^9.0.0",
  "chalk": "^5.0.0",
  "dotenv": "^16.0.0",
  "keytar": "^7.9.0",
  "axios": "^1.0.0",
  "ora": "^6.0.0"
}
```

---

### Phase 2: Backend + Database (Week 3–4)

**What to build:**
- Express app with TypeScript
- PostgreSQL setup with all migrations
- GitHub OAuth (passport-github2)
- PAT token creation + validation middleware
- Core routes: `/auth`, `/api/projects`, `/api/schema/push`, `/api/schema/pull`, `/api/schema/status`
- Audit log service (called after every mutation)
- Unit tests for schema push/pull and drift computation

**Key challenges:**
- Atomic schema push: wrap all DB writes in a transaction, diff against existing schema before writing
- PAT token security: store bcrypt hash in DB, compare on each request (use `bcrypt.compare` — don't short-circuit compare)
- Value detection heuristic in sanitize middleware: reject payloads where `description` or `defaultHint` look like actual secrets (long random strings, strings with `=` signs in suspicious positions)

**Expected outcome:** Backend fully functional. CLI can push/pull to real cloud backend.

---

### Phase 3: Dashboard UI (Week 5–6)

**What to build:**
- React + TypeScript + Vite setup
- GitHub OAuth redirect flow
- Dashboard, ProjectDetail, EnvironmentDiff, AuditLog pages
- VariableTable, DriftAlert components
- PAT token management UI
- `.env.example` copy-to-clipboard and download

**Key challenges:**
- Environment diff view: building an intuitive 3-column table (only in A / in both / only in B)
- Audit log pagination: implement cursor-based pagination (not offset) for large logs

**Expected outcome:** Fully usable dashboard. A new team member can onboard using only the dashboard.

---

### Phase 4: Real-time + Alerts (Week 7)

**What to build:**
- Socket.io server-side with project-based rooms
- `drift:update` event emitted after every schema push
- React `useDrift` hook subscribes to events, updates UI live
- Slack webhook integration: settings page accepts a Slack webhook URL, backend POSTs on drift
- `envguard pull` triggers a server-sent refresh event to other connected clients

**Key challenges:**
- Socket.io authentication: validate session or PAT in the socket handshake middleware
- Slack message formatting: use Block Kit for rich, readable drift alerts

**Expected outcome:** Open the dashboard on two devices, push from CLI on one — the other updates in real-time within 1 second.

---

### Phase 5: Polish + Deployment (Week 8)

**What to build:**
- Error handling and loading states throughout dashboard
- CLI `--help` output polish, man-page style
- `envguard diff` command
- README with GIF demo (use `terminalizer` to record CLI session)
- Deploy backend to Railway or Render
- Deploy frontend to Vercel
- Publish CLI to npm: `npm publish --access public`
- GitHub Actions CI: lint + test on push

**Key challenges:**
- npm publish: ensure `bin` field in `package.json` points to the right entry, test with `npm link` locally first
- `.nvmrc` and Node version pinning to avoid issues for users on older Node versions

**Expected outcome:** A live, publicly usable product. An npm package with a real install count growing.

---

## 8. Tech Stack Justification

| Technology | Role | Why Chosen | Alternative Considered |
|---|---|---|---|
| **Node.js** | CLI + Backend | Single language across the stack; enormous npm ecosystem for CLI tooling; `commander`, `inquirer`, `chalk` are mature and well-documented | Python (would require separate runtime install on user machine — bad for CLI UX) |
| **Express** | API framework | Minimal overhead, maximum control; widely understood in interviews | Fastify (faster, but less familiar), NestJS (too heavy for this scope) |
| **PostgreSQL** | Primary database | ACID compliance critical for audit log integrity; `JSONB` for metadata; `UNIQUE` constraints enforce data model rules at DB level | MySQL (weaker JSON support), SQLite (no concurrent writes) |
| **React + TypeScript** | Dashboard frontend | Type safety catches schema shape mismatches; component model maps cleanly to variable tables and diff views | Next.js (overkill — no SSR needed for a dashboard), Vue (less common in Indian SDE interviews) |
| **Vite** | Frontend build | Fastest dev server; instant HMR; no config ceremony | CRA (dead), Webpack (slow) |
| **Socket.io** | Real-time | Automatic fallback to long-polling; room-based broadcasting maps perfectly to "project rooms" | native WebSocket (no rooms, no fallback), Pusher (paid) |
| **keytar** | CLI token storage | Stores secrets in OS keychain (Keychain on macOS, libsecret on Linux, Credential Manager on Windows) — the only correct way to store credentials in a CLI | plaintext file in home dir (insecure), environment variables (not persistent) |
| **commander** | CLI framework | Most mature Node CLI framework; auto-generates `--help`; subcommand support | yargs (similar, less clean API), oclif (too heavy) |
| **inquirer** | CLI prompts | Battle-tested interactive prompts; checkbox, list, input — all needed for `push` flow | prompts (lighter but fewer features) |
| **chalk** | CLI colors | De facto standard; works on all terminals | kleur (faster but less widely known) |
| **bcrypt** | Token hashing | Industry standard for storing authentication tokens | SHA-256 (not suitable for auth tokens — timing attacks) |

---

## 9. Deployment Strategy

### Backend (Railway recommended for students)

```
Platform: Railway.app (free tier, auto-deploy from GitHub)
Runtime: Node 20 LTS
Database: Railway PostgreSQL addon (or Supabase free tier)

Environment variables needed on Railway:
  DATABASE_URL=postgresql://...
  SESSION_SECRET=<random 64 char string>
  GITHUB_CLIENT_ID=<from GitHub OAuth app>
  GITHUB_CLIENT_SECRET=<from GitHub OAuth app>
  CALLBACK_URL=https://api.envguard.dev/auth/github/callback
  FRONTEND_URL=https://envguard.dev
  NODE_ENV=production
```

**GitHub OAuth App setup:**
```
Go to: github.com/settings/developers → OAuth Apps → New OAuth App
  Application name: EnvGuard
  Homepage URL: https://envguard.dev
  Callback URL: https://api.envguard.dev/auth/github/callback
```

---

### Frontend (Vercel)

```
Platform: Vercel (free tier, auto-deploy from GitHub)
Framework: Vite (detected automatically)

Environment variables on Vercel:
  VITE_API_URL=https://api.envguard.dev
  VITE_SOCKET_URL=wss://api.envguard.dev
```

**`vercel.json` for SPA routing:**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

### CLI (npm)

```json
// package.json in envguard-cli/
{
  "name": "envguard",
  "version": "0.1.0",
  "description": "Sync .env schemas across your team without storing secrets",
  "bin": {
    "envguard": "./bin/envguard.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": ["bin/", "src/"],
  "keywords": ["dotenv", "env", "cli", "developer-tools", "environment"],
  "license": "MIT"
}
```

**Publishing steps:**
```bash
npm login
npm publish --access public

# Verify installation
npm install -g envguard
envguard --version
```

**Versioning strategy:** Semantic versioning. `patch` for bug fixes, `minor` for new commands, `major` for breaking schema changes.

---

## 10. Resume & Portfolio Positioning

### Resume Bullet Points

```
EnvGuard — Developer Tooling | Open Source | npm
• Built an open-source CLI + SaaS platform for syncing .env schemas
  across teams, implementing a zero-secrets architecture where variable
  values never leave the developer's machine
• Designed and published an npm CLI package (commander, inquirer, keytar)
  with 5 subcommands, OS keychain-based auth, and offline-first schema
  caching, installable via npm install -g envguard
• Engineered a real-time drift detection system using Socket.io with
  project-based rooms, broadcasting schema change events to connected
  dashboard clients within <1 second of a CLI push
• Architected a PostgreSQL schema with append-only audit logging,
  optimistic locking for concurrent pushes, and UNIQUE constraints
  enforcing the zero-secrets model at the database layer
• Implemented GitHub OAuth with server-side sessions and PAT token
  authentication (bcrypt-hashed) for CI/CD pipeline integration
```

---

### How to Demo in Interviews

**The 90-second demo script:**

```
"EnvGuard solves a problem every development team has — .env files get
out of sync, they're shared over Slack DMs, and new developers waste
hours on setup.

[Terminal] Let me show you. I run `envguard push` in my project —
it reads my .env, strips all the values, prompts me to describe each
variable, and pushes just the schema to the cloud. No secrets ever
leave my machine.

[Dashboard] Now on a teammate's machine, they open the dashboard and
immediately see a drift alert — they're missing 2 variables. They run
`envguard pull` and get a perfectly documented .env.example.

[Terminal] And if you're in CI, `envguard status` exits with code 1
if the schema is out of sync — so you can fail a build before it
reaches production.

The interesting engineering problem here was the zero-secrets
constraint. I had to design the whole system — the CLI parser,
the API sanitization middleware, the database schema — around the
invariant that a value can never be transmitted. Happy to walk
through how that works."
```

**Follow-up questions to prepare for:**
- "How do you verify no values are transmitted?" → Open source CLI, sanitization middleware, audit on the wire format
- "What happens if two people push at the same time?" → Optimistic locking with version numbers, `ERR_SCHEMA_CONFLICT`
- "How would you scale this to 10,000 teams?" → Redis adapter for Socket.io, read replicas for audit log queries, schema snapshots in S3

---

## 11. Bonus — 10x Ideas

### Ideas That Make EnvGuard Startup-Worthy

---

**1. Secret Rotation Reminders**
EnvGuard knows *which* variables are of type `secret`. Add a `rotationPolicy` field: "This variable should be rotated every 90 days." EnvGuard tracks when it was last "acknowledged" in the schema and alerts the team when it's due. No other tool does this in a developer-friendly way.

---

**2. `.env` Validator with Type Enforcement**
Since EnvGuard knows the type of each variable (url, port, boolean, etc.), the CLI can add a `validate` command that actually checks your local values against the types:
```
$ envguard validate

  ✖ PORT=abc — expected port (integer 1–65535), got string
  ✖ DATABASE_URL=localhost — expected url, got bare hostname
  ✔ DEBUG_MODE=false — valid boolean
```
This is genuinely useful and something no existing tool does.

---

**3. GitHub PR Integration as a Status Check**
When a PR modifies migration files or adds new API route files, a GitHub App (installable, not just a webhook) posts an EnvGuard check:
```
EnvGuard Schema Check — REQUIRES ATTENTION
  Production is missing 1 new variable added in this PR: PAYMENT_PROCESSOR_KEY
  [ Acknowledge and merge ] [ View in EnvGuard ]
```
This is enterprise-grade safety tooling delivered for free.

---

**4. `envguard generate` for Deployment Platforms**
Given the schema, generate platform-specific deployment configs:
```
$ envguard generate --for railway > railway.toml
$ envguard generate --for vercel > .vercel/env.json
$ envguard generate --for github-actions > .github/env-template.yml
```
Each generated file has all variable names but empty values — ready for the platform's secret manager UI.

---

**5. Schema as Code (`.envschema.yml`)**
Instead of (or alongside) the CLI pushing to the cloud, support a `.envschema.yml` file that can be committed to the repository:
```yaml
# .envschema.yml
version: 1
variables:
  - key: DATABASE_URL
    type: url
    description: PostgreSQL connection string
    required: true
    environments: [development, staging, production]
  - key: DEBUG_MODE
    type: boolean
    required: false
    default: false
    environments: [development]
```
This makes EnvGuard usable even without the cloud service — pure open-source, zero dependency. The SaaS layer adds collaboration, audit, and real-time on top. This is the correct open-core architecture.

---

*End of EnvGuard Blueprint — ready to build.*
