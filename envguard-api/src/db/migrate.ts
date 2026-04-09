import fs from 'fs';
import path from 'path';
import { pool } from './index';

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    // 3. Execute unrun migrations
    for (const file of files) {
      const { rows } = await client.query('SELECT name FROM _migrations WHERE name = $1', [file]);
      if (rows.length === 0) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Successfully migrated: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Migration failed: ${file}`);
          throw err;
        }
      } else {
        console.log(`Skipping migration: ${file} (already executed)`);
      }
    }
    
    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  } finally {
    client.release();
    // Don't pool.end() if we're calling this inline, but mostly this runs standalone wrapper
  }
}

// Allow running from CLI directly
if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

export { runMigrations };
