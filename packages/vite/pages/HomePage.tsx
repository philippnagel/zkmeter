import React, { useState, useEffect } from 'react';
import { useProofGeneration } from '../hooks/useProofGeneration.js';
import { generateOutputs } from '../utils/outputGenerator.js';
import { getCircuit } from '../../noir/compile.js';
import { ProofData } from '@noir-lang/types';
import { Link } from 'react-router-dom';
import { UltraPlonkBackend } from '@aztec/bb.js';
import { ToastContainer, toast } from 'react-toastify';

interface ProofPackage {
  proof: Uint8Array;
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

const HomePage = () => {
  const [inputs, setInputs] = useState<any>();
  const { proofData } = useProofGeneration(inputs);
  const [outputs, setOutputs] = useState<{ json: any; edi: string } | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [exportInProgress, setExportInProgress] = useState(false);
  
  // Add state for date inputs
  const [billingDates, setBillingDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // State for reading date with default value
  const [readingDate, setReadingDate] = useState(
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  // Set default timestamp when component mounts
  useEffect(() => {
    const defaultTimestamp = Math.floor(new Date(readingDate).getTime() / 1000);
    const timestampInput = document.querySelector('[name="timestamp"]') as HTMLInputElement;
    if (timestampInput) {
      timestampInput.value = defaultTimestamp.toString();
    }
  }, [readingDate]);
  
  // Convert date to timestamp
  const dateToTimestamp = (dateString: string): number => {
    return Math.floor(new Date(dateString).getTime() / 1000);
  };
  
  // Convert timestamp to date
  const timestampToDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
  
    let errorMessage = "";
    if (name === 'endDate' && value < billingDates.startDate) {
      errorMessage = "End date cannot be before start date";
    } else if (name === 'startDate' && value > billingDates.endDate) {
      errorMessage = "Start date cannot be after end date";
    }
  
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
  
    setBillingDates((prev) => ({
      ...prev,
      [name]: value,
    }));
  };  

  const handleReadingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setReadingDate(newDate);
    
    // Update the timestamp hidden input
    const timestamp = dateToTimestamp(newDate);
    const timestampInput = document.querySelector('[name="timestamp"]') as HTMLInputElement;
    if (timestampInput) {
      timestampInput.value = timestamp.toString();
    }
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
    
    // Collect validation errors
    const errors: string[] = [];
    
    // Validate readings
    if (parseInt(formData.current_reading) < parseInt(formData.previous_reading)) {
      errors.push("Current reading cannot be less than previous reading");
    }
    
    // Validate timestamp within billing period
    const timestamp = parseInt(formData.timestamp);
    if (timestamp < startTimestamp || timestamp > endTimestamp) {
      errors.push("Reading timestamp must be within the billing period");
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
      errors.push(`Invoice amount should be ${calculatedAmount} based on consumption and rates`);
    }
    
    // Display errors if any
    if (errors.length > 0) {
      toast.error(errors.join(" | "));
      return;
    }

    // Structure the inputs
    const structuredInputs = {
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
    delete structuredInputs.previous_reading;
    delete structuredInputs.current_reading;
    delete structuredInputs.timestamp;
    delete structuredInputs.base_rate;
    delete structuredInputs.threshold;
    delete structuredInputs.excess_rate;
    delete structuredInputs.contract_id;
    
    setInputs(structuredInputs);
    toast.info("Generating proof...");
  };
  
  const handleGenerateOutputs = () => {
    if (!proofData || !inputs) {
      toast.error("Cannot generate outputs: Missing proof data or inputs");
      return;
    }
    const generatedOutputs = generateOutputs(proofData, inputs);
    setOutputs(generatedOutputs);
    toast.success("Outputs generated successfully!");
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
    if (exportInProgress) return;
    setExportInProgress(true);
    
    if (!proofData || !inputs) {
      toast.error("No proof data available to export");
      setExportInProgress(false);
      return;
    }
    
    try {
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
    } catch (error) {
      console.error("Error exporting proof:", error);
      toast.error("Failed to export proof");
    } finally {
      setExportInProgress(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form className="bg-white shadow-md rounded-lg p-6 mb-8" onSubmit={submit}>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Energy Metering Application</h1>
        <h2 className="text-lg text-gray-600 mb-6">Generate an invoice based on your energy consumption</h2>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p className="text-yellow-700">
            <strong>Important:</strong> All monetary values must be entered as integers.
            For example, enter "491" for a rate of 4.91 (cents per kWh).
          </p>
        </div>
  
        {/* Meter Reading Information */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Meter Reading Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Previous Reading</label>
              <input
                name="previous_reading"
                type="number"
                placeholder="Previous Reading"
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">The last meter reading value (in kWh)</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Current Reading</label>
              <input
                name="current_reading"
                type="number"
                placeholder="Current Reading"
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Must be greater than or equal to previous reading</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="reading_date">Reading Date</label>
              <input
                id="reading_date"
                name="reading_date"
                type="date"
                value={readingDate}
                onChange={handleReadingDateChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                name="timestamp"
                type="hidden"
                defaultValue={dateToTimestamp(readingDate).toString()}
              />
              <p className="text-xs text-gray-500">Date when the reading was taken (must be within billing period)</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Meter ID</label>
              <input
                name="meter_id"
                type="text"
                placeholder="Meter ID"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Unique identifier for the meter</p>
            </div>
          </div>
        </div>
        
        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Customer ID</label>
              <input
                name="customer_id"
                type="text"
                placeholder="Customer ID"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Unique identifier for the customer</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Contract ID</label>
              <input
                name="contract_id"
                type="text"
                placeholder="Contract ID"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Contract identifier between customer and supplier</p>
            </div>
          </div>
        </div>
        
        {/* Pricing Information */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Pricing Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Base Rate</label>
              <input
                name="base_rate"
                type="number"
                placeholder="Base Rate (integer)"
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Price per kWh for consumption up to threshold (as integer, e.g. 491 for 4.91)</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Threshold</label>
              <input
                name="threshold"
                type="number"
                placeholder="Threshold"
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">kWh limit for base rate pricing</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Excess Rate</label>
              <input
                name="excess_rate"
                type="number"
                placeholder="Excess Rate (integer)"
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500">Price per kWh for consumption above threshold (as integer, e.g. 591 for 5.91)</p>
            </div>
          </div>
        </div>
        
        {/* Billing Period */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Billing Period</h3>
          <div className="bg-blue-50 p-4 rounded-md mb-4 text-center">
            <p className="text-blue-800 font-medium">
              {formatDate(billingDates.startDate)} to {formatDate(billingDates.endDate)}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="startDate">Start Date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={billingDates.startDate}
                onChange={handleDateChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="endDate">End Date</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={billingDates.endDate}
                onChange={handleDateChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Display calculated amount */}
        {calculatedAmount !== null && (
          <div className="mb-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
            <h4 className="text-blue-800 font-medium mb-1">Calculated Invoice Amount: {calculatedAmount}</h4>
            <p className="text-sm text-blue-600">Enter this exact integer value in the Invoice Amount field to satisfy the circuit constraints</p>
          </div>
        )}
        
        {/* Invoice Amount */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Invoice Information</h3>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Invoice Amount</label>
            <input
              name="invoice_amount"
              type="number"
              placeholder="Invoice Amount (integer)"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">Must match the calculated amount based on consumption and rates (as integer)</p>
          </div>
        </div>
        
        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Generate Proof
        </button>
        
        {/* Help section */}
        <div className="mt-8 bg-gray-50 p-4 rounded-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">How Invoice Amount is Calculated</h3>
          <p className="text-gray-600 mb-3">The invoice amount is calculated based on the following formula:</p>
          <ol className="list-decimal pl-5 space-y-2 text-gray-600">
            <li>Calculate consumption: Current Reading - Previous Reading</li>
            <li>
              If consumption is less than or equal to the threshold:
              <ul className="list-disc pl-5 mt-1">
                <li>Amount = Consumption × Base Rate</li>
              </ul>
            </li>
            <li>
              If consumption exceeds the threshold:
              <ul className="list-disc pl-5 mt-1">
                <li>Amount = (Threshold × Base Rate) + ((Consumption - Threshold) × Excess Rate)</li>
              </ul>
            </li>
          </ol>
          <p className="text-gray-600 mt-3">The circuit will verify that your entered invoice amount matches this calculation.</p>
          <p className="text-gray-600 mt-2"><strong>Note:</strong> All monetary values must be entered as integers. For example, enter "491" for a rate of 4.91 (cents per kWh).</p>
        </div>
      </form>
      
      {proofData && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <button 
              onClick={handleGenerateOutputs} 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 ease-in-out"
            >
              Generate Outputs
            </button>
            <button 
              onClick={exportProof} 
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 ease-in-out"
            >
              Export Proof
            </button>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Off-Chain Verification</h3>
            <p className="text-gray-600 mb-4">To verify this proof off-chain:</p>
            <ol className="list-decimal pl-5 space-y-3 text-gray-600">
              <li>Export the proof using the button above</li>
              <li>
                Use one of the following methods to verify:
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>
                    <strong>Web Verifier:</strong> <Link to="/verifier" className="text-blue-600 hover:underline">Use our Web Verifier</Link> to upload and verify your proof
                  </li>
                  <li>
                    <strong>Command Line:</strong> Use the Noir CLI tool:
                    <pre className="bg-gray-800 text-gray-200 p-3 rounded-md mt-2 text-sm overflow-x-auto">
                      noir verify --proof path/to/proof.json
                    </pre>
                  </li>
                  <li>
                    <strong>Programmatic:</strong> Use the Noir JS library:
                    <pre className="bg-gray-800 text-gray-200 p-3 rounded-md mt-2 text-sm overflow-x-auto">
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
  console.log(isValid ? 'Proof is valid' : 'Proof is invalid');
  `}</pre>
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        )}
        
        {outputs && (
  <div className="bg-white shadow-md rounded-lg p-6 mb-8">
    <h3 className="text-lg font-semibold text-gray-700 mb-4">Generated Outputs</h3>
    <div className="output-section mb-6">
      <h4 className="text-md font-medium text-gray-600 mb-2">JSON Output</h4>
      <div className="bg-gray-100 p-4 rounded-md overflow-x-auto">
        <pre className="text-sm text-gray-700 font-mono">
          {JSON.stringify(outputs.json, null, 2)}
        </pre>
      </div>
    </div>
    <div className="output-section">
      <h4 className="text-md font-medium text-gray-600 mb-2">EDI@Energy INVOIC Output</h4>
      <div className="bg-gray-100 p-4 rounded-md overflow-x-auto">
        <pre className="text-sm text-gray-700 font-mono">{outputs.edi}</pre>
      </div>
    </div>
  </div>
)}
        <ToastContainer />
      </div>
    );
  }
  
  export default HomePage;