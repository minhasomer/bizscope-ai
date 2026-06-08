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
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
