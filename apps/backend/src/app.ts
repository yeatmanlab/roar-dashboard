import express from 'express';
import type { Request, Response } from 'express';
import { isHttpError } from 'http-errors';
import { registerAllRoutes } from './routes';

const app = express();

app.use(express.json());

registerAllRoutes(app);

// Error handling middleware
app.use((err: unknown, _req: Request, res: Response) => {
  // Convert HTTP errors to JSON responses (e.g. 404 Not Found)
  if (isHttpError(err)) {
    return res.status(err.statusCode).json({ error: { message: err.message } });
  }

  // Fallback for unexpected errors
  return res.status(500).json({ error: { message: 'An unexpected error occurred' } });
});

export default app;
