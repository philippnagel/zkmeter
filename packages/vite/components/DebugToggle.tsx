import React, { useState } from 'react';
import { enableDebugMode, disableDebugMode } from '../utils/logger.js';

const DebugToggle = () => {
    const [debugEnabled, setDebugEnabled] = useState(false);
  
    const toggleDebugMode = () => {
      if (debugEnabled) {
        disableDebugMode();
      } else {
        enableDebugMode();
      }
      setDebugEnabled(!debugEnabled);
    };
  
    return (
      <button
        onClick={toggleDebugMode}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '8px',
          backgroundColor: debugEnabled ? '#ff5252' : '#4caf50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        {debugEnabled ? 'Disable Debug Mode' : 'Enable Debug Mode'}
      </button>
    );
  };  

export default DebugToggle;