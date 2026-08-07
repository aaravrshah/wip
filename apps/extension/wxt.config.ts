import { defineConfig } from 'wxt';

import { DEVELOPMENT_EXTENSION_PUBLIC_KEY } from './src/extension-identity';
import { createExtensionManifest } from './src/manifest';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: () =>
    createExtensionManifest({
      apiOrigin: import.meta.env.WXT_WIP_API_ORIGIN || 'http://localhost:3000',
      clerkFrontendApiOrigin:
        import.meta.env.WXT_CLERK_FRONTEND_API_ORIGIN || 'https://clerk.example.invalid',
      extensionPublicKey:
        import.meta.env.WXT_WIP_EXTENSION_PUBLIC_KEY || DEVELOPMENT_EXTENSION_PUBLIC_KEY,
    }),
  vite: () => ({ build: { sourcemap: false } }),
});
