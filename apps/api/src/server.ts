import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env FIRST before any other imports
// Load from the api app directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { buildApp } from './app';

const port = Number(process.env.PORT || 4000);
const app = buildApp();
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`API listening on ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
