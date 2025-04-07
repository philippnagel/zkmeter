import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { getCircuit } from '../../noir/compile.js';
import { UltraPlonkBackend } from '@aztec/bb.js';

interface SerializableProofPackage {
  proof: number[];
  publicInputs: string[];
  inputs: any;
  timestamp: string;
  metadata: {
    customer_id: string;
    meter_id: string;
    billing_period: {
      start: string;
      end: string;
    };
  };
}

const VerifierPage = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid?: boolean;
    proofDetails?: SerializableProofPackage;
    error?: string;
  }>({});

  const verifyProofOffChain = async (proofPackage: SerializableProofPackage) => {
    try {
      console.log("Verifying proof:", proofPackage);
      
      // Reconstruct the proof data in the format expected by verifyProof
      const reconstructedProofData = {
        proof: new Uint8Array(proofPackage.proof),
        publicInputs: proofPackage.publicInputs
      };
      
      // Get the circuit and create the backend
      const circuit = await getCircuit();
      const backend = new UltraPlonkBackend(circuit.bytecode);
      
      // Verify the proof
      return await backend.verifyProof(reconstructedProofData);
    } catch (error) {
      console.error("Error verifying proof:", error);
      throw error;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsVerifying(true);
    setVerificationResult({});
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const proofPackage = JSON.parse(event.target?.result as string) as SerializableProofPackage;
          
          // Verify the proof
          const isValid = await verifyProofOffChain(proofPackage);
          
          setVerificationResult({
            isValid,
            proofDetails: proofPackage
          });
          
          if (isValid) {
            toast.success("Proof verified successfully!");
          } else {
            toast.error("Proof verification failed!");
          }
        } catch (error) {
          console.error("Error parsing or verifying proof:", error);
          setVerificationResult({
            isValid: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
          toast.error("Error verifying proof");
        } finally {
          setIsVerifying(false);
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      setIsVerifying(false);
      setVerificationResult({
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      toast.error("Error reading file");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Proof Verifier</h1>
        
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            Upload a proof file to verify it. The verifier will check if the proof is valid and display the details.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <label className="block">
              <span className="text-gray-700 font-medium">Upload Proof File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="mt-2 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
                disabled={isVerifying}
              />
            </label>
            {isVerifying && (
              <div className="mt-4 text-blue-600">
                <svg className="animate-spin h-5 w-5 mr-3 inline" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying proof...
              </div>
            )}
          </div>
        </div>
        
        {verificationResult.isValid !== undefined && (
          <div className={`rounded-lg p-6 ${
            verificationResult.isValid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              verificationResult.isValid ? 'text-green-700' : 'text-red-700'
            }`}>
              {verificationResult.isValid 
                ? '✓ Proof is Valid' 
                : '✗ Proof is Invalid'}
            </h2>
            
            {verificationResult.error ? (
              <p className="text-red-600">{verificationResult.error}</p>
            ) : verificationResult.proofDetails ? (
              <div className="bg-white rounded p-4 shadow-sm">
                <h3 className="font-medium text-gray-700 mb-2">Proof Details</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="text-sm">
                    <span className="font-medium">Customer ID:</span> {verificationResult.proofDetails.metadata.customer_id}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Meter ID:</span> {verificationResult.proofDetails.metadata.meter_id}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Billing Period:</span>{' '}
                    {new Date(verificationResult.proofDetails.metadata.billing_period.start).toLocaleDateString()} to{' '}
                    {new Date(verificationResult.proofDetails.metadata.billing_period.end).toLocaleDateString()}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Invoice Amount:</span> {verificationResult.proofDetails.inputs.invoice_amount}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
        
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-700 mb-3">Other Verification Methods</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Command Line</h4>
              <div className="bg-gray-800 text-gray-200 p-3 rounded text-sm font-mono">
                noir verify --proof path/to/proof.json
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Programmatic</h4>
              <div className="bg-gray-800 text-gray-200 p-3 rounded text-sm font-mono overflow-x-auto">
{`import { UltraPlonkBackend } from '@aztec/bb.js';
import { getCircuit } from './circuit.js';
import { readFileSync } from 'fs';

// Load proof package
const proofPackage = JSON.parse(readFileSync('path/to/proof.json'));

// Reconstruct the proof data
const proofData = {
  proof: new Uint8Array(proofPackage.proof),
  publicInputs: proofPackage.publicInputs
};

// Get circuit and create backend
const circuit = await getCircuit();
const backend = new UltraPlonkBackend(circuit.bytecode);

// Verify proof
const isValid = await backend.verifyProof(proofData);
console.log(isValid ? 'Proof is valid' : 'Proof is invalid');`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifierPage;