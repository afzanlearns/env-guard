import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { query } from '../db';

const router = Router();

router.get('/', requireAuth, async (req: any, res) => {
  try {
    const { rows } = await query('SELECT * FROM projects WHERE owner_id = $1', [req.user.id]);
    res.json({ projects: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', requireAuth, async (req: any, res) => {
  const { name, githubRepo } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  try {
    await query('BEGIN');
    const projRes = await query(
      `INSERT INTO projects (name, slug, owner_id, github_repo) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, slug, req.user.id, githubRepo]
    );

    const project = projRes.rows[0];

    // Seed standard environments
    const envsToSeed = ['development', 'staging', 'production'];
    for (const envName of envsToSeed) {
      await query(
        `INSERT INTO environments (project_id, name) VALUES ($1, $2)`,
        [project.id, envName]
      );
    }
    
    await query('COMMIT');
    res.json(project);
  } catch (err) {
    await query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create project (slug might be taken)' });
  }
});

export default router;
