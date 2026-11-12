import 'reflect-metadata';
import { createSpikeApp } from './bootstrap-app.js';

const app = await createSpikeApp();
await app.listen(Number(process.env.PORT ?? 3100), '127.0.0.1');
