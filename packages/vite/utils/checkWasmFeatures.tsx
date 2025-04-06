import { logger } from './logger.js';
import * as wasmFeatureDetect from 'wasm-feature-detect';

export async function checkWasmFeatures() {
  try {
    logger.info('Checking WebAssembly support in the browser...');

    const supportsThreads = await wasmFeatureDetect.threads();
    const supportsBulkMemory = await wasmFeatureDetect.bulkMemory();
    const supportsSimd = await wasmFeatureDetect.simd();
    const supportsReferenceTypes = await wasmFeatureDetect.referenceTypes();
    const supportsExceptions = await wasmFeatureDetect.exceptions();
    const supportsTailCall = await wasmFeatureDetect.tailCall();

    logger.info('WebAssembly feature detection results:');
    logger.info(`Threads: ${supportsThreads ? 'Supported' : 'Not Supported'}`);
    logger.info(`Bulk Memory: ${supportsBulkMemory ? 'Supported' : 'Not Supported'}`);
    logger.info(`SIMD: ${supportsSimd ? 'Supported' : 'Not Supported'}`);
    logger.info(`Reference Types: ${supportsReferenceTypes ? 'Supported' : 'Not Supported'}`);
    logger.info(`Exceptions: ${supportsExceptions ? 'Supported' : 'Not Supported'}`);
    logger.info(`Tail Call: ${supportsTailCall ? 'Supported' : 'Not Supported'}`);

    return {
      supportsThreads,
      supportsBulkMemory,
      supportsSimd,
      supportsReferenceTypes,
      supportsExceptions,
      supportsTailCall,
    };
  } catch (error) {
    logger.error('Error during WebAssembly feature detection:', error);
    throw error;
  }
}