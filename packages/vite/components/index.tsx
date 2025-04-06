import { useState } from 'react';
import React from 'react';
import { useProofGeneration } from '../hooks/useProofGeneration.js';
import { generateOutputs } from '../utils/outputGenerator.js';
import { UltraPlonkBackend } from '@aztec/bb.js';
import { getCircuit } from '../../noir/compile.js';
import { ProofData } from '@noir-lang/types';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../App.css';

interface ProofPackage {
  proof: Uint8Array;
  publicInputs: string[];
  inputs: any; // You could define a more specific type for your inputs
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

function Component() {
  const [inputs, setInputs] = useState<any>();
  const { proofData } = useProofGeneration(inputs);
  const [outputs, setOutputs] = useState<{ json: any; edi: string } | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  
  // Add state for date inputs
  const [billingDates, setBillingDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Convert date to timestamp
  const dateToTimestamp = (dateString: string): number => {
    return Math.floor(new Date(dateString).getTime() / 1000);
  };

  // Convert timestamp to date
  const timestampToDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  };

  // Handle date changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate date range
    if (name === 'endDate' && value < billingDates.startDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    if (name === 'startDate' && value > billingDates.endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }
    
    setBillingDates(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const calculateAmount = () => {
    const previousReading = parseInt((document.querySelector('[name="previous_reading"]') as HTMLInputElement)?.value || '0');
    const currentReading = parseInt((document.querySelector('[name="current_reading"]') as HTMLInputElement)?.value || '0');
    const baseRate = parseInt((document.querySelector('[name="base_rate"]') as HTMLInputElement)?.value || '0');
    const threshold = parseInt((document.querySelector('[name="threshold"]') as HTMLInputElement)?.value || '0');
    const excessRate = parseInt((document.querySelector('[name="excess_rate"]') as HTMLInputElement)?.value || '0');
    
    if (isNaN(previousReading) || isNaN(currentReading) || isNaN(baseRate) || 
        isNaN(threshold) || isNaN(excessRate)) {
      return null;
    }
    
    const consumption = currentReading - previousReading;
    if (consumption < 0) return null;
    
    let amount;
    if (consumption <= threshold) {
      amount = consumption * baseRate;
    } else {
      amount = threshold * baseRate + (consumption - threshold) * excessRate;
    }
    
    return amount;
  };

  const handleInputChange = () => {
    setCalculatedAmount(calculateAmount());
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData: any = {};
    const elements = e.currentTarget.elements;
    Array.from(elements).forEach((element: any) => {
      if (element.name) {
        formData[element.name] = element.value;
      }
    });
  
    // Convert date inputs to timestamps
    const startTimestamp = dateToTimestamp(billingDates.startDate);
    const endTimestamp = dateToTimestamp(billingDates.endDate);
    
    // Add timestamps to formData
    formData.billing_period_start = startTimestamp;
    formData.billing_period_end = endTimestamp;
    
    // Validate readings
    if (parseInt(formData.current_reading) < parseInt(formData.previous_reading)) {
      toast.error("Current reading cannot be less than previous reading");
      return;
    }
  
    // Validate timestamp within billing period
    const timestamp = parseInt(formData.timestamp);
    if (timestamp < startTimestamp || timestamp > endTimestamp) {
      toast.error("Reading timestamp must be within the billing period");
      return;
    }
  
    // Validate invoice amount matches calculation
    const consumption = parseInt(formData.current_reading) - parseInt(formData.previous_reading);
    const baseRate = parseInt(formData.base_rate);
    const threshold = parseInt(formData.threshold);
    const excessRate = parseInt(formData.excess_rate);
    
    let calculatedAmount;
    if (consumption <= threshold) {
      calculatedAmount = consumption * baseRate;
    } else {
      calculatedAmount = threshold * baseRate + (consumption - threshold) * excessRate;
    }
    
    // For validation, compare the integer values directly
    const invoiceAmountInt = parseInt(formData.invoice_amount);
    if (Math.abs(calculatedAmount - invoiceAmountInt) > 1) { // Allow for 1 unit of rounding error
      toast.error(`Invoice amount should be ${calculatedAmount} based on consumption and rates`);
      return;
    }
  
    // Structure the inputs
    const inputs = {
      ...formData,
      reading: {
        previous_reading: parseInt(formData.previous_reading),
        current_reading: parseInt(formData.current_reading),
        timestamp: parseInt(formData.timestamp),
        meter_id: formData.meter_id,
      },
      pricing: {
        base_rate: parseInt(formData.base_rate),
        threshold: parseInt(formData.threshold),
        excess_rate: parseInt(formData.excess_rate),
      },
      customer: {
        customer_id: formData.customer_id,
        contract_id: formData.contract_id,
      },
      // Public inputs
      invoice_amount: parseInt(formData.invoice_amount),
      meter_id: formData.meter_id,
      customer_id: formData.customer_id,
      billing_period_start: startTimestamp,
      billing_period_end: endTimestamp,
    };
  
    // Remove the now-nested fields from the root level
    delete inputs.previous_reading;
    delete inputs.current_reading;
    delete inputs.timestamp;
    delete inputs.base_rate;
    delete inputs.threshold;
    delete inputs.excess_rate;
    delete inputs.contract_id;
  
    setInputs(inputs);
  };  
  
  const handleGenerateOutputs = () => {
    if (!proofData || !inputs) return;
    const generatedOutputs = generateOutputs(proofData, inputs);
    setOutputs(generatedOutputs);
  };

  // Format a date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Function to export proof data as a JSON file
  const exportProof = () => {
    if (!proofData || !inputs) {
      toast.error("No proof data available to export");
      return;
    }
    
    // Create a serializable version of the proof data
    const serializableProof: SerializableProofPackage = {
      proof: Array.from(proofData.proof),
      publicInputs: proofData.publicInputs as string[],
      inputs: inputs,
      timestamp: new Date().toISOString(),
      metadata: {
        customer_id: inputs.customer_id,
        meter_id: inputs.meter_id,
        billing_period: {
          start: new Date(inputs.billing_period_start * 1000).toISOString(),
          end: new Date(inputs.billing_period_end * 1000).toISOString()
        }
      }
    };
    
    // Convert to JSON and create a Blob
    const proofBlob = new Blob([JSON.stringify(serializableProof, null, 2)], { type: 'application/json' });
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(proofBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `energy-proof-${inputs.customer_id}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Proof exported successfully");
  };

  return (
    <>
      <form className="container" onSubmit={submit}>
        <h1>Energy Metering Application</h1>
        <h2>Generate an invoice based on your energy consumption</h2>
        
        <div className="important-notice">
          <strong>Important:</strong> All monetary values must be entered as integers. 
          For example, enter "491" for a rate of 4.91 (cents per kWh).
        </div>

        {/* Meter Reading Information */}
        <div className="form-section">
          <h3>Meter Reading Information</h3>
          <div className="input-group">
            <input 
              name="previous_reading" 
              type="number" 
              placeholder="Previous Reading"
              onChange={handleInputChange}
              required 
            />
            <small className="input-help">The last meter reading value (in kWh)</small>
          </div>
          
          <div className="input-group">
            <input 
              name="current_reading" 
              type="number" 
              placeholder="Current Reading"
              onChange={handleInputChange}
              required 
            />
            <small className="input-help">Must be greater than or equal to previous reading</small>
          </div>
          
                  <div className="input-group">
          <label htmlFor="reading_date">Reading Date:</label>
            <input
            id="reading_date"
            name="reading_date"
            type="date"
            defaultValue={new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            onChange={(e) => {
              const timestamp = dateToTimestamp(e.target.value);
              (document.querySelector('[name="timestamp"]') as HTMLInputElement).value = timestamp.toString();
            }}
            required
          />
          <input
            name="timestamp"
            type="hidden"
            defaultValue={Math.floor(Date.now() - 24 * 60 * 60 * 1000)}
          />
          <small className="input-help">Date when the reading was taken (must be within billing period)</small>
        </div>

          <div className="input-group">
            <input 
              name="meter_id" 
              type="text" 
              placeholder="Meter ID" 
              required 
            />
            <small className="input-help">Unique identifier for the meter</small>
          </div>
        </div>

        {/* Customer Information */}
        <div className="form-section">
          <h3>Customer Information</h3>
          <div className="input-group">
            <input name="customer_id" type="text" placeholder="Customer ID" required />
            <small className="input-help">Unique identifier for the customer</small>
          </div>
          <div className="input-group">
            <input name="contract_id" type="text" placeholder="Contract ID" required />
            <small className="input-help">Contract identifier between customer and supplier</small>
          </div>
        </div>

        {/* Pricing Information */}
        <div className="form-section">
          <h3>Pricing Information</h3>
          <div className="input-group">
            <input 
              name="base_rate" 
              type="number" 
              placeholder="Base Rate (integer)"
              onChange={handleInputChange}
              required 
            />
            <small className="input-help">Price per kWh for consumption up to threshold (as integer, e.g. 491 for 4.91)</small>
          </div>
          <div className="input-group">
            <input 
              name="threshold" 
              type="number" 
              placeholder="Threshold"
              onChange={handleInputChange}
              required 
            />
            <small className="input-help">kWh limit for base rate pricing</small>
          </div>
          <div className="input-group">
            <input 
              name="excess_rate" 
              type="number" 
              placeholder="Excess Rate (integer)"
              onChange={handleInputChange}
              required 
            />
            <small className="input-help">Price per kWh for consumption above threshold (as integer, e.g. 591 for 5.91)</small>
          </div>
        </div>

        {/* Billing Period - Improved with date inputs */}
        <div className="form-section">
          <h3>Billing Period</h3>
          <div className="date-range-display">
            {formatDate(billingDates.startDate)} to {formatDate(billingDates.endDate)}
          </div>
          <div className="date-inputs">
            <div className="input-group">
              <label htmlFor="startDate">Start Date:</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={billingDates.startDate}
                onChange={handleDateChange}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="endDate">End Date:</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={billingDates.endDate}
                onChange={handleDateChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Display calculated amount */}
        {calculatedAmount !== null && (
          <div className="calculation-preview">
            <h4>Calculated Invoice Amount: {calculatedAmount}</h4>
            <small>Enter this exact integer value in the Invoice Amount field to satisfy the circuit constraints</small>
          </div>
        )}

        {/* Invoice Amount */}
        <div className="form-section">
          <h3>Invoice Information</h3>
          <div className="input-group">
            <input 
              name="invoice_amount" 
              type="number" 
              placeholder="Invoice Amount (integer)" 
              required 
            />
            <small className="input-help">Must match the calculated amount based on consumption and rates (as integer)</small>
          </div>
        </div>

        <button type="submit">Generate Proof</button>
        
        {/* Help section */}
        <div className="help-section">
          <h3>How Invoice Amount is Calculated</h3>
          <p>The invoice amount is calculated based on the following formula:</p>
          <ol>
            <li>Calculate consumption: Current Reading - Previous Reading</li>
            <li>If consumption is less than or equal to the threshold:
              <ul>
                <li>Amount = Consumption × Base Rate</li>
              </ul>
            </li>
            <li>If consumption exceeds the threshold:
              <ul>
                <li>Amount = (Threshold × Base Rate) + ((Consumption - Threshold) × Excess Rate)</li>
              </ul>
            </li>
          </ol>
          <p>The circuit will verify that your entered invoice amount matches this calculation.</p>
          <p><strong>Note:</strong> All monetary values must be entered as integers. For example, enter "491" for a rate of 4.91 (cents per kWh).</p>
        </div>
      </form>
      
      {proofData && (
        <div className="proof-actions">
          <button onClick={handleGenerateOutputs}>Generate Outputs</button>
          <button onClick={exportProof} className="export-button">Export Proof</button>
          
          <div className="verification-instructions">
            <h3>Off-Chain Verification</h3>
            <p>To verify this proof off-chain:</p>
            <ol>
              <li>Export the proof using the button above</li>
              <li>Use one of the following methods to verify:
                <ul>
                  <li><strong>Web Verifier:</strong> Upload the proof file to our <a href="#" onClick={(e) => {
                    e.preventDefault();
                    // You could navigate to a verification page here
                    // or open a verification modal
                    document.getElementById('verification-modal')?.classList.add('visible');
                  }}>Web Verifier</a></li>
                  <li><strong>Command Line:</strong> Use the Noir CLI tool:
                    <pre>noir verify --proof path/to/proof.json</pre>
                  </li>
                  <li><strong>Programmatic:</strong> Use the Noir JS library:
                  <pre>{`
import { UltraPlonkBackend } from '@aztec/bb.js';
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
console.log(isValid ? 'Proof is valid' : 'Proof is invalid');
`}</pre>
                  </li>
                </ul>
              </li>
            </ol>
          </div>
        </div>
      )}
      
      {/* Verification Modal */}
      <div id="verification-modal" className="modal">
        <div className="modal-content">
          <span className="close" onClick={() => {
            document.getElementById('verification-modal')?.classList.remove('visible');
          }}>&times;</span>
          <h2>Verify Proof</h2>
          <div className="file-upload">
            <label htmlFor="proof-file">Upload Proof File:</label>
            <input 
              type="file" 
              id="proof-file" 
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                  try {
                    const proofPackage = JSON.parse(event.target?.result as string) as SerializableProofPackage;
                    
                    // Verify the proof using the reconstructed proof data
                    const isValid = await verifyProofOffChain(proofPackage);
                    
                    if (isValid) {
                      toast.success("Proof verified successfully!");
                      document.getElementById('verification-result')!.innerHTML = `
                        <div class="success-message">
                          <h3>✓ Proof is Valid</h3>
                          <p>This proof has been verified off-chain.</p>
                          <div class="proof-details">
                            <p><strong>Customer ID:</strong> ${proofPackage.metadata.customer_id}</p>
                            <p><strong>Meter ID:</strong> ${proofPackage.metadata.meter_id}</p>
                            <p><strong>Billing Period:</strong> ${new Date(proofPackage.metadata.billing_period.start).toLocaleDateString()} to ${new Date(proofPackage.metadata.billing_period.end).toLocaleDateString()}</p>
                            <p><strong>Invoice Amount:</strong> ${proofPackage.inputs.invoice_amount}</p>
                          </div>
                        </div>
                      `;
                    } else {
                      toast.error("Proof verification failed!");
                      document.getElementById('verification-result')!.innerHTML = `
                        <div class="error-message">
                          <h3>✗ Proof is Invalid</h3>
                          <p>This proof could not be verified.</p>
                        </div>
                      `;
                    }
                  } catch (error) {
                    console.error("Error parsing or verifying proof:", error);
                    toast.error("Error parsing or verifying proof");
                    document.getElementById('verification-result')!.innerHTML = `
                      <div class="error-message">
                        <h3>✗ Error Processing Proof</h3>
                        <p>An error occurred while processing the proof: ${error}</p>
                      </div>
                    `;
                  }
                };
                reader.readAsText(file);
              }}
            />
          </div>
          <div id="verification-result"></div>
        </div>
      </div>
      
      {outputs && (
        <div className="outputs">
          <h3>Generated Outputs</h3>
          <div className="output-section">
            <h4>JSON Output</h4>
            <pre>{JSON.stringify(outputs.json, null, 2)}</pre>
          </div>
          <div className="output-section">
            <h4>EDI@Energy INVOIC Output</h4>
            <pre>{outputs.edi}</pre>
          </div>
        </div>
      )}
      <ToastContainer />
    </>
  );
}

// Perform off-chain proof verification using UltraPlonk
async function verifyProofOffChain(proofPackage: SerializableProofPackage) {
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
    return false;
  }
}

export default Component;