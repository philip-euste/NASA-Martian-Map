const fs = require('fs');

const data = JSON.parse(fs.readFileSync('frontend/public/data/meda_processed_bundle.json', 'utf8'));

let totalPdsRecords = 0;
let totalSampleObservations = 0;

console.log('MEDA Bundle Products Summary:');
console.log('='.repeat(90));

data.products.forEach((p, idx) => {
  const prod = p.product;
  const sampleCount = (p.sample_observations || []).length;
  totalPdsRecords += prod.record_count;
  totalSampleObservations += sampleCount;
  console.log(
    `Product ${idx + 1}: Sensor ${prod.sensor.padEnd(5)} | Sol ${prod.sol} | ` +
    `PDS Record Count: ${String(prod.record_count).padStart(6)} | ` +
    `Sample Observations in JSON: ${String(sampleCount).padStart(5)} | ` +
    `${prod.title}`
  );
});

console.log('-'.repeat(90));
console.log(`Products: ${data.products.length}`);
console.log(`Total PDS4 source record count (sum of product.record_count): ${totalPdsRecords}`);
console.log(`Total sample observations stored in JSON: ${totalSampleObservations}`);

// Sols represented:
const sols = [...new Set(data.products.map(p => p.product.sol))];
console.log(`Sols represented: ${sols.join(', ')}`);

// Sensors represented:
const sensors = [...new Set(data.products.map(p => p.product.sensor))];
console.log(`Sensors represented: ${sensors.join(', ')}`);
