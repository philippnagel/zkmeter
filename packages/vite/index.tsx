import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from './components/index.jsx';
import DebugToggle from './components/DebugToggle.jsx';
import { checkWasmFeatures } from './utils/checkWasmFeatures.js'; // Import the detection utility
import { logger } from './utils/logger.js'; // Import the logger

// Detect WebAssembly features before rendering the app
async function detectWasmFeatures() {
  try {
    logger.info('Initializing WebAssembly feature detection...');
    const features = await checkWasmFeatures();

    // Log the detected features
    logger.info('WebAssembly feature detection results:', features);

    // You can add additional logic here if needed, such as warnings or fallbacks
    if (!features.supportsThreads) {
      logger.warn('WebAssembly threads are not supported. Performance may be degraded.');
    }
  } catch (error) {
    logger.error('Error detecting WebAssembly features:', error);
  }
}

// Run detection
detectWasmFeatures();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <div>
      <DebugToggle /> {/* Add the DebugToggle to the app */}
      <Component />
    </div>
  </React.StrictMode>
);