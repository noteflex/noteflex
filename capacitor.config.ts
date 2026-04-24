import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.domisol.app',
  appName: 'Domisol',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    App: {
      launchUrl: "domisol://"
    }
  }
};

export default config;
