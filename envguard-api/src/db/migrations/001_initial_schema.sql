-- Users (populated via GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id     VARCHAR(64) UNIQUE NOT NULL,
  username      VARCHAR(128) NOT NULL,
  email         VARCHAR(256),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (one per repository or logical app)
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(256) NOT NULL,
  slug          VARCHAR(256) UNIQUE NOT NULL,  -- used in CLI config
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  github_repo   VARCHAR(512),                  -- optional repo link
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Environments (dev, staging, prod, or custom)
CREATE TABLE IF NOT EXISTS environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(128) NOT NULL,          -- "development", "production", etc.
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Schema Variables (the core table — NEVER stores values)
CREATE TABLE IF NOT EXISTS schema_variables (
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
CREATE TABLE IF NOT EXISTS audit_log (
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
CREATE TABLE IF NOT EXISTS team_members (
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
CREATE TABLE IF NOT EXISTS tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(256) NOT NULL,           -- "My MacBook", "CI/CD Pipeline"
  token_hash    VARCHAR(512) NOT NULL UNIQUE,    -- bcrypt hash of the token
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                     -- null = no expiry
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (Handle with IF NOT EXISTS wrapping logic isn't clean for CREATE INDEX without pg11+, will do safe queries or accept if fails via TS ignore, wait actually IF NOT EXISTS on indexes is purely pg9.5+)
CREATE INDEX IF NOT EXISTS idx_schema_variables_env_id ON schema_variables(environment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_project_id ON audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_project_id ON team_members(project_id);
