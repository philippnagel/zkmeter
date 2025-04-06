import { defineConfig } from '@wagmi/cli';
import { react, hardhat } from '@wagmi/cli/plugins';
import deployment from '../../deployment.json' with { type: 'json' };
import { resolve } from 'path';

export default defineConfig({
  out: 'artifacts/generated.ts',
  plugins: [
    react(),
    hardhat({
      project: resolve(__dirname, '../..'),
      artifacts: resolve(__dirname, '/../packages/artifacts'),
      deployments: {
        UltraVerifier: {
          [deployment.networkConfig.id]: deployment.address as `0x${string}`,
        },
      },
    }),
  ],
});