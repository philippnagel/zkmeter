import { compile, createFileManager } from '@noir-lang/noir_wasm';
import { CompiledCircuit } from '@noir-lang/types';
import { logger } from '../vite/utils/logger.js';

export async function getCircuit() {
  try {
    logger.info('Creating file manager...');
    const fm = createFileManager('/');

    logger.info('Fetching main.nr...');
    const main = (await fetch(new URL(`./src/main.nr`, import.meta.url))).body as ReadableStream<Uint8Array>;
    logger.debug('Fetched main.nr:', main);

    logger.info('Fetching Nargo.toml...');
    const nargoToml = (await fetch(new URL(`./Nargo.toml`, import.meta.url))).body as ReadableStream<Uint8Array>;
    logger.debug('Fetched Nargo.toml:', nargoToml);

    logger.info('Writing files to file manager...');
    fm.writeFile('./src/main.nr', main);
    fm.writeFile('./Nargo.toml', nargoToml);

    logger.info('Compiling circuit...');
    const result = await compile(fm);
    logger.debug('Compilation result:', result);

    if (!('program' in result)) {
      throw new Error('Compilation failed: No program found in result');
    }

    logger.info('Circuit compiled successfully');
    return result.program as CompiledCircuit;
  } catch (err) {
    logger.error('Error during circuit fetching or compilation:', err);
    throw err;
  }
}