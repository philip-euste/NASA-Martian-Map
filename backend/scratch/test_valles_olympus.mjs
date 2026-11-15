// backend/scratch/test_valles_olympus.mjs
import fs from 'node:fs';

async function checkRegion(name, url, startByte, endByte, startRow, minLat, maxLat, minLon, maxLon, centerLat, centerLon, isNorth) {
  console.log(`\n=== Testing ${name} ===`);
  console.log(`Downloading ${((endByte - startByte)/1024/1024).toFixed(2)} MB from ${url}...`);
  const res = await fetch(url, { headers: { 'Range': `bytes=${startByte}-${endByte}` } });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${buf.length} bytes.`);

  // Center elevation
  const centerRow = isNorth ? Math.round((44.0 - centerLat) * 128) : Math.round((0.0 - centerLat) * 128);
  const rowOffset = centerRow - startRow;
  const westLon = url.includes('270') ? 270.0 : url.includes('180') ? 180.0 : 90.0;
  const centerCol = Math.round((centerLon - westLon) * 128);
  const centerSampleOffset = (rowOffset * 11520 + centerCol) * 2;
  const centerElev = buf.readInt16BE(centerSampleOffset);
  console.log(`Center (${centerLat}°, ${centerLon}°E) Elevation: ${centerElev} meters`);

  // Min and max in bounds
  const r0 = isNorth ? Math.round((44.0 - maxLat) * 128) : Math.round((0.0 - maxLat) * 128);
  const r1 = isNorth ? Math.round((44.0 - minLat) * 128) : Math.round((0.0 - minLat) * 128);
  const c0 = Math.round((minLon - westLon) * 128);
  const c1 = Math.round((maxLon - westLon) * 128);

  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let r = r0; r <= r1; r++) {
    const rOff = r - startRow;
    if (rOff < 0 || rOff >= buf.length / (11520 * 2)) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= 11520) continue;
      const elev = buf.readInt16BE((rOff * 11520 + c) * 2);
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }
  }
  console.log(`${name} bounds [${minLat}..${maxLat}°, ${minLon}..${maxLon}°E]: min ${minElev} m, max ${maxElev} m (relief: ${maxElev - minElev} m)`);
}

async function run() {
  // Valles Marineris (Melas Chasma)
  // megt00n270hb: Lat 0 to -44, Lon 270 to 360
  // Melas Chasma: Lat -11.5 to -8.0, Lon 281.5 to 285.8 (-78.5 to -74.2W), Center: Lat -9.8, Lon 283.6
  await checkRegion(
    'Valles Marineris (Melas Chasma)',
    'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt00n270hb.img',
    1020 * 11520 * 2,
    (1481 * 11520 * 2) - 1,
    1020,
    -11.5, -8.0, 281.5, 285.8, -9.8, 283.6, false
  );

  // Olympus Mons (Summit Caldera)
  // megt44n180hb: Lat 44 to 0, Lon 180 to 270
  // Caldera: Lat 17.0 to 20.2, Lon 224.5 to 228.0 (-135.5 to -132.0W), Center: Lat 18.65, Lon 226.2
  await checkRegion(
    'Olympus Mons (Summit Caldera)',
    'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt44n180hb.img',
    3040 * 11520 * 2,
    (3466 * 11520 * 2) - 1,
    3040,
    17.0, 20.2, 224.5, 228.0, 18.65, 226.2, true
  );
}

run().catch(console.error);
