import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';

const envFile = process.env.ENVIRONMENT === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

const environment = process.env.ENVIRONMENT || 'development';
console.log(`Starting server in ${environment} mode`);

const app = express();
app.use(express.json());

const allowedOrigins = ['http://localhost:5173', 'https://chat.selfrevolutions.com'];
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/api', authRoutes);
app.use('/api', chatRoutes);

app.get('/api/ping', (_: Request, res: Response) => {
  res.json({ message: `pong from ${environment}` });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Justin Lite backend running in ${environment} mode on port ${PORT}`);
});
