import 'dotenv/config';
import { buildApp } from './app';
import { registerCronJobs } from './cron';
import { assertEnv } from './core/env';

assertEnv();

const port = Number(process.env.PORT ?? 4000);
// Railway, Render and Fly all route to the container's external interface.
// Binding the default (localhost only) makes the service unreachable and the
// healthcheck fail with no error in the logs.
const host = process.env.HOST ?? '0.0.0.0';
const app = buildApp();

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`SmartRO API listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Health: http://localhost:${port}/health`);
  registerCronJobs();
});
