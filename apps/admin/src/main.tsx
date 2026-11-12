import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { loadRuntimeConfig } from './runtime-config';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

void loadRuntimeConfig().then((config) => {
  createRoot(root).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );
});
