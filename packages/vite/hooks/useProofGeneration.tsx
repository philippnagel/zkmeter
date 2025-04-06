import { toast } from 'react-toastify';
import { useEffect, useState } from 'react';
import { getCircuit } from '../../noir/compile.js';
import { UltraPlonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { ProofData } from '@noir-lang/types';
import { logger } from '../utils/logger.js';

// Import and manually initialize WASM modules
import { default as initNoirC } from '@noir-lang/noirc_abi';
import { default as initACVM } from '@noir-lang/acvm_js';
const acvm = new URL('@noir-lang/acvm_js/web/acvm_js_bg.wasm', import.meta.url).href;
const noirc = new URL('@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm', import.meta.url).href;

export function useProofGeneration(inputs?: { [key: string]: string }) {
  const [proofData, setProofData] = useState<ProofData | undefined>();
  const [backend, setBackend] = useState<UltraPlonkBackend>();
  const [noir, setNoir] = useState<Noir | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inputs) return;

    async function proofGeneration() {
      try {
        logger.info('Starting proof generation...');
        logger.debug('Inputs provided:', inputs);
        
        // Validate inputs before executing the circuit
        logger.info('Validating inputs...');
        const requiredFields = ['customer', 'reading', 'pricing'];
        for (const field of requiredFields) {
          if (!(inputs as { [key: string]: string })[field]) {
            throw new Error(`Missing required input: ${field}`);
          }
        }
        // YOLO instantiate WASM modules
        logger.info('Initializing WASM modules...');
        try {
          // ts-ignore
            // @ts-ignore
            await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
          logger.info('WASM modules initialized successfully.');
        } catch (wasmError) {
          logger.error('Failed to initialize WASM modules:', wasmError);
          toast.error('Failed to initialize WASM modules. Please check your setup.');
          setError('Failed to initialize WASM modules.');
          return;
        }

        // Fetch the circuit
        logger.info('Fetching circuit...');
        let circuit;
        try {
          circuit = await getCircuit();
          logger.debug('Circuit fetched:', circuit);
        } catch (fetchError) {
          logger.error('Failed to fetch the circuit:', fetchError);
          toast.error('Failed to fetch the circuit. Please check your configuration.');
          setError('Failed to fetch the circuit.');
          return;
        }

        // Initialize backend
        logger.info('Initializing UltraPlonk backend...');
        let backend;
        try {
          backend = new UltraPlonkBackend(circuit.bytecode, {
            threads: navigator.hardwareConcurrency,
          });
          logger.debug('Backend initialized:', backend);
        } catch (backendError) {
          logger.error('Failed to initialize backend:', backendError);
          toast.error('Failed to initialize backend. Please ensure WASM is loaded correctly.');
          setError('Failed to initialize backend.');
          return;
        }

        // Create Noir instance
        logger.info('Creating Noir instance...');
        let noir;
        try {
          noir = new Noir(circuit);
          logger.debug('Noir instance created:', noir);
        } catch (noirCreationError) {
          logger.error('Failed to create Noir instance:', noirCreationError);
          toast.error('Failed to create Noir instance. Please check your Noir configuration.');
          setError('Failed to create Noir instance.');
          return;
        }

        // Initialize Noir
        logger.info('Initializing Noir...');
        try {
          await noir.init();
          logger.info('Noir initialized successfully');
        } catch (noirInitError) {
          logger.error('Failed to initialize Noir:', noirInitError);
          toast.error('Failed to initialize Noir. Please check your WASM setup.');
          setError('Failed to initialize Noir.');
          return;
        }

        

        // Execute Noir circuit
        logger.info('Executing Noir circuit...');
        let witness;
        try {
          console.log('Executing Noir with inputs:', inputs);
          const result = await noir.execute(inputs || {});
          witness = result.witness;
          logger.debug('Witness generated:', witness);
        } catch (executionError) {
          logger.error('Failed to execute Noir circuit:', executionError);
          toast.error('Failed to execute Noir circuit. Please check your inputs.');
          setError('Failed to execute Noir circuit.');
          return;
        }

        // Generate proof
        logger.info('Generating proof...');
        let data;
        try {
          data = await backend.generateProof(witness);
          logger.info('Proof generated successfully');
          logger.debug('Generated proof data:', data);
        } catch (proofError) {
          logger.error('Failed to generate proof:', proofError);
          toast.error('Failed to generate proof. Please ensure all dependencies are configured correctly.');
          setError('Failed to generate proof.');
          return;
        }

        // Update state
        setProofData(data);
        setNoir(noir);
        setBackend(backend);
        setError(null); // Clear any previous errors
        toast.success('Proof generated successfully!');
      } catch (err) {
        logger.error('Unexpected error during proof generation:', err);
        toast.error('An unexpected error occurred during proof generation.');
        setError('An unexpected error occurred.');
      }
    }

    proofGeneration();
  }, [inputs]);

  return { noir, proofData, backend, error };
}