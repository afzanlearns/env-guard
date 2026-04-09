import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { sanitizeSchemaPayload } from '../middleware/sanitize.middleware';
import { query } from '../db';

const router = Router();

// Helper to resolve envId safely
async function getEnvId(projectSlug: string, environmentName: string) {
  const res = await query(
    `SELECT e.id FROM environments e 
     JOIN projects p ON p.id = e.project_id 
     WHERE p.slug = $1 AND e.name = $2`,
    [projectSlug, environmentName]
  );
  return res.rows[0]?.id;
}

router.post('/push', requireAuth, sanitizeSchemaPayload, async (req: any, res) => {
  const { projectSlug, environment, variables } = req.body;
  
  if (!projectSlug || !environment || !variables) {
    return res.status(400).json({ error: 'Missing required payload fields' });
  }

  const envId = await getEnvId(projectSlug, environment);
  if (!envId) return res.status(404).json({ error: 'Project or environment not found' });

  try {
    await query('BEGIN');
    
    let added = 0;
    let updated = 0;

    for (const v of variables) {
      // Upsert: ZERO SECRETS logic explicitly happens here - no "value" field exists in DB schema anyway
      const upsertQuery = `
        INSERT INTO schema_variables (environment_id, key, type, description, required, default_hint, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (environment_id, key) DO UPDATE SET
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          required = EXCLUDED.required,
          default_hint = EXCLUDED.default_hint,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert
      `;
      const res = await query(upsertQuery, [
        envId, v.key, v.type || 'string', v.description || '', v.required !== false, v.defaultHint || null, req.user.id
      ]);

      if (res.rows[0].is_insert) added++; else updated++;
    }

    // Determine removed logically (anything previously in DB not in variables array payload)
    const currentKeys = variables.map((v: any) => v.key);
    const delQuery = `
      DELETE FROM schema_variables 
      WHERE environment_id = $1 AND key != ALL($2::text[])
    `;
    const delRes = await query(delQuery, [envId, currentKeys]);
    const removed = delRes.rowCount;

    // Log to Audit Log
    const projRes = await query('SELECT id FROM projects WHERE slug = $1', [projectSlug]);
    await query(`
      INSERT INTO audit_log (project_id, environment_id, actor_id, action, metadata, source)
      VALUES ($1, $2, $3, 'schema_pushed', $4, 'cli')
    `, [projRes.rows[0].id, envId, req.user.id, JSON.stringify({ added, updated, removed })]);

    await query('COMMIT');
    res.json({ syncedCount: variables.length, added, updated, removed });
  } catch (err) {
    await query('ROLLBACK');
    res.status(500).json({ error: 'Failed to push schema' });
  }
});

router.get('/pull', requireAuth, async (req, res) => {
  const { projectSlug, environment } = req.query as { projectSlug: string, environment: string };
  
  if (!projectSlug || !environment) return res.status(400).json({ error: 'Missing params' });

  const envId = await getEnvId(projectSlug, environment);
  if (!envId) return res.status(404).json({ error: 'Project or environment not found' });

  const { rows } = await query('SELECT key, type, description, required, default_hint as "defaultHint" FROM schema_variables WHERE environment_id = $1', [envId]);

  res.json({
    environment,
    variables: rows,
    lastSyncedAt: new Date().toISOString()
  });
});

router.post('/status', requireAuth, async (req, res) => {
  const { projectSlug, environment, localKeys } = req.body;
  if (!projectSlug || !environment || !Array.isArray(localKeys)) return res.status(400).json({ error: 'Bad request' });

  const envId = await getEnvId(projectSlug, environment);
  if (!envId) return res.status(404).json({ error: 'Not found' });

  const { rows } = await query('SELECT key FROM schema_variables WHERE environment_id = $1', [envId]);
  const teamKeys = rows.map(r => r.key);

  const missing = teamKeys.filter(k => !localKeys.includes(k));
  const extra = localKeys.filter(k => !teamKeys.includes(k));
  const synced = teamKeys.filter(k => localKeys.includes(k));

  res.json({ missing, extra, synced });
});

export default router;
