import { useState } from 'react';
import React from 'react';
import { useProofGeneration } from './hooks/useProofGeneration.js';
import { generateOutputs } from './utils/outputGenerator.js';
import { createRoot } from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function Component() {
  const [inputs, setInputs] = useState<any>();
  const { proofData } = useProofGeneration(inputs);
  const [outputs, setOutputs] = useState<{ json: any; edi: string } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData: any = {};
    const elements = e.currentTarget.elements;
    Array.from(elements).forEach((element: any) => {
      if (element.name) {
        formData[element.name] = element.value;
      }
    });
    setInputs(formData);
  };

  const handleGenerateOutputs = () => {
    if (!proofData || !inputs) return;
    const generatedOutputs = generateOutputs(proofData, inputs);
    setOutputs(generatedOutputs);
  };

  return (
    <>
      <form className="container" onSubmit={submit}>
        <h1>Energy Metering Application</h1>
        <h2>Generate an invoice based on your energy consumption</h2>

        <div className="form-section">
          <h3>Meter Reading Information</h3>
          <input name="previous_reading" type="number" placeholder="Previous Reading" required />
          <input name="current_reading" type="number" placeholder="Current Reading" required />
          <input name="timestamp" type="number" placeholder="Timestamp" defaultValue={Math.floor(Date.now() / 1000)} required />
          <input name="meter_id" type="text" placeholder="Meter ID" required />
        </div>

        <div className="form-section">
          <h3>Customer Information</h3>
          <input name="customer_id" type="text" placeholder="Customer ID" required />
          <input name="contract_id" type="text" placeholder="Contract ID" required />
        </div>

        <div className="form-section">
          <h3>Pricing Information</h3>
          <input name="base_rate" type="number" step="0.01" placeholder="Base Rate" required />
          <input name="threshold" type="number" placeholder="Threshold" required />
          <input name="excess_rate" type="number" step="0.01" placeholder="Excess Rate" required />
        </div>

        <div className="form-section">
          <h3>Billing Period</h3>
          <input name="billing_period_start" type="number" placeholder="Billing Period Start (timestamp)" defaultValue={Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)} required />
          <input name="billing_period_end" type="number" placeholder="Billing Period End (timestamp)" defaultValue={Math.floor(Date.now() / 1000)} required />
        </div>

        <button type="submit">Generate Proof</button>
      </form>

      {proofData && (
        <button onClick={handleGenerateOutputs}>Generate Outputs</button>
      )}
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

export default Component;

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
