import express from 'express';
import { registerAllRoutes } from './routes';

const app = express();

app.use(express.json());

registerAllRoutes(app);

export default app;
