import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/auth';
import schemaRoutes from './routes/schema';

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api/schema', schemaRoutes);

// Basic healthcheck
app.get('/', (req, res) => {
  res.json({ message: 'EnvGuard API is running' });
});

// Start the server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
