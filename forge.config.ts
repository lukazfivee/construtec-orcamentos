import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    junk: false,
    prune: false,
    extraResource: [
      'node_modules/@electric-sql/pglite',
      'src/assets',
    ],
    name: 'ConstrutecOrcamentos',
    executableName: 'ConstrutecOrcamentos',
    icon: 'src/assets/app-icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'ConstrutecOrcamentos',
      authors: 'Construtec Engenharia',
      description: 'Orçamentos profissionais, rápidos, seguros e offline para a Construtec Engenharia.',
      setupExe: 'Construtec-Orcamentos-1.0.5-Setup.exe',
      loadingGif: 'src/assets/install-splash.gif',
      setupIcon: 'src/assets/app-icon.ico',
      noMsi: true,
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
