import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Use ?? not || so that an absent env var defaults to the safe value
        // rather than the permissive one.  With ||, undefined || 'true' = 'true',
        // meaning every build without an explicit env var was silently in demo mode.
        'process.env.VITE_DEMO_MODE': JSON.stringify(env.VITE_DEMO_MODE ?? 'false'),
        'process.env.VITE_REAL_REPORTS_ENABLED': JSON.stringify(env.VITE_REAL_REPORTS_ENABLED ?? 'false'),
        'process.env.VITE_BETA_ROLES': JSON.stringify(env.VITE_BETA_ROLES ?? ''),
        // Private-beta full-access override. When 'true', every authenticated
        // non-Admin user receives effective Pro+ entitlement client-side.
        // Defaults to 'false' so omitting the var is always the safe production state.
        'process.env.VITE_BETA_FULL_ACCESS': JSON.stringify(env.VITE_BETA_FULL_ACCESS ?? 'false'),
        'process.env.VITE_BETA_CLOSED': JSON.stringify(env.VITE_BETA_CLOSED ?? 'false'),
        // Pro 7-day trial promotional display toggle.
        // CLIENT-SIDE ONLY. Defaults to 'false' — safe to omit in production.
        // Falls back to process.env directly so Vercel's injected build-time
        // env vars are picked up even when loadEnv reads from .env files only.
        'process.env.VITE_PRO_TRIAL_ENABLED': JSON.stringify(
          env.VITE_PRO_TRIAL_ENABLED ?? process.env.VITE_PRO_TRIAL_ENABLED ?? 'false',
        ),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
