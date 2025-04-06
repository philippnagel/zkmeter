// Main Noir circuit for private energy metering with JSON/EDI output

// Define the struct for energy consumption data
struct MeterReading {
    previous_reading: Field,
    current_reading: Field,
    timestamp: Field,
    meter_id: Field,
}

// Define the struct for pricing information
struct PricingInfo {
    base_rate: Field,
    threshold: Field,
    excess_rate: Field,
}

// Define the struct for customer information
struct CustomerInfo {
    customer_id: Field,
    contract_id: Field,
}

// Main function that creates the proof
fn main(
    reading: MeterReading,
    pricing: PricingInfo,
    customer: CustomerInfo,
    invoice_amount: pub Field,
    meter_id: pub Field,
    customer_id: pub Field,
    billing_period_start: pub Field,
    billing_period_end: pub Field
) {
    // Validate meter reading
    {
        assert(reading.current_reading as u32 >= reading.previous_reading as u32);
    }

    // Calculate consumption
    let consumption = reading.current_reading - reading.previous_reading;

    // Calculate invoice amount
    let calculated_amount = calculate_invoice_amount(consumption, pricing);

    // Assertions for public inputs
    {
        assert(calculated_amount == invoice_amount);
        assert(reading.meter_id == meter_id);
        assert(customer.customer_id == customer_id);
        assert(reading.timestamp as u32 >= billing_period_start as u32);
        assert(reading.timestamp as u32 <= billing_period_end as u32);
    }
}

// Helper function to calculate invoice amount
fn calculate_invoice_amount(consumption: Field, pricing: PricingInfo) -> Field {
    let mut total_cost = 0;

    if consumption as u32 <= pricing.threshold as u32 {
        total_cost = consumption * pricing.base_rate;
    } else {
        total_cost = pricing.threshold * pricing.base_rate;

        let excess = consumption - pricing.threshold;
        total_cost += excess * pricing.excess_rate;
    }

    total_cost
}