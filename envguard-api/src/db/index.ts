import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/envguard'
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
