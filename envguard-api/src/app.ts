import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/auth';
import schemaRoutes from './routes/schema';
import projectRoutes from './routes/projects';
import passport from './services/auth.service';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';

const PgStore = connectPgSimple(session);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: 'session' }), 
  secret: process.env.SESSION_SECRET || 'envguard-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 30 * 24 * 60 * 60 * 1000, 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/projects', projectRoutes);

import { createServer } from 'http';
import { initializeSockets } from './sockets/drift.socket';

// Basic healthcheck
app.get('/', (req, res) => {
  res.json({ message: 'EnvGuard API is running' });
});

const server = createServer(app);

// Initialize Socket.io injecting the session block
initializeSockets(server, sessionMiddleware);

// Start the server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default server;
