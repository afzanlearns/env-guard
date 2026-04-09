import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { query } from '../db';
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'dummy_client_id';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/auth/github/callback';

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // 1. Check if user exists
      const { rows } = await query('SELECT * FROM users WHERE github_id = $1', [profile.id]);
      
      let user;
      if (rows.length > 0) {
        user = rows[0];
        // 2. Update user if needed
        await query(
          'UPDATE users SET username = $1, email = $2, avatar_url = $3 WHERE id = $4',
          [profile.username, profile.emails?.[0]?.value || null, profile._json.avatar_url, user.id]
        );
      } else {
        // 3. Create new user
        const result = await query(
          `INSERT INTO users (github_id, username, email, avatar_url)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [profile.id, profile.username, profile.emails?.[0]?.value || null, profile._json.avatar_url]
        );
        user = result.rows[0];
      }
      
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

export default passport;
