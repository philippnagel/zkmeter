import { ProofData } from '@noir-lang/types';
import { toast } from 'react-toastify';

export function generateOutputs(proofData: ProofData, inputs: any) {
  const { invoice_amount, meter_id, customer_id, billing_period_start, billing_period_end } = inputs;

  const jsonOutput = {
    invoice: {
      invoice_number: `INV-${Date.now()}`,
      invoice_date: new Date().toISOString().split('T')[0],
      billing_period: {
        start_date: new Date(billing_period_start * 1000).toISOString().split('T')[0],
        end_date: new Date(billing_period_end * 1000).toISOString().split('T')[0],
      },
      customer: { customer_id },
      meter: { meter_id },
      amount: {
        net_amount: invoice_amount,
        tax_rate: inputs.tax_rate || 19.0,
        tax_amount: invoice_amount * (inputs.tax_rate / 100 || 0.19),
        total_amount: invoice_amount * 1.19,
        currency: 'EUR',
      },
    },
  };

  const ediOutput = `UNA:+.? '
UNB+UNOC:3+${customer_id}:500+SUPPLIER:500+${new Date().toISOString()}+ZKP${Date.now()}+++++1'
UNH+1+INVOIC:D:01B:UN:EAN010'
BGM+380+ZKP${Date.now()}+9'
DTM+137:${new Date().toISOString().split('T')[0]}:102'
DTM+3:${new Date(billing_period_start * 1000).toISOString().split('T')[0]}:102'
DTM+4:${new Date(billing_period_end * 1000).toISOString().split('T')[0]}:102'
NAD+BY+${customer_id}::9'
NAD+SU+SUPPLIER::9'
CUX+2:EUR:4'
MOA+203:${invoice_amount}'
TAX+7+VAT+++:::19+S'
MOA+124:${invoice_amount * 0.19}'
MOA+128:${invoice_amount * 1.19}'
UNT+25+1'
UNZ+1+ZKP${Date.now()}'`;

  toast.success('Outputs generated successfully!');
  return { json: jsonOutput, edi: ediOutput };
}