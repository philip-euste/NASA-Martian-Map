// backend/scratch/create_simulator_htmls.mjs
import fs from 'node:fs';
import path from 'node:path';

const sourceHtml = fs.readFileSync('frontend/src/simulator/jezero_crater/scripts/jezero-simulator.html', 'utf8');

const targets = [
  {
    path: 'frontend/src/simulator/gale_crater/scripts/gale-simulator.html',
    title: 'Gale Crater (Mount Sharp) — Marswalk 3D Surface Simulation',
    status: 'Preparing Gale Crater (Mount Sharp) terrain...',
    h1: 'Gale Crater (Mount Sharp) Surface',
    desc: 'Walk the authentic NASA PDS MGS MOLA 128 ppd digital elevation model of Gale Crater under Martian partial gravity (0.38g · 3.71 m/s²). Explore Mount Sharp (Aeolis Mons), Yellowknife Bay, and Vera Rubin Ridge.',
    eyebrow: 'GALE CRATER DEM · INTERACTIVE TACTICAL MAP [M]',
    script: '/src/simulator/gale_crater/src/gale_main.ts',
  },
  {
    path: 'frontend/src/simulator/valles_marineris/scripts/valles-simulator.html',
    title: 'Valles Marineris (Melas Chasma) — Marswalk 3D Surface Simulation',
    status: 'Preparing Valles Marineris terrain...',
    h1: 'Valles Marineris (Melas Chasma) Surface',
    desc: 'Walk the authentic NASA PDS MGS MOLA 128 ppd digital elevation model of Valles Marineris under Martian partial gravity (0.38g · 3.71 m/s²). Traverse the 8.4-km deep Melas Chasma canyon floor and towering wall scarps.',
    eyebrow: 'VALLES MARINERIS DEM · INTERACTIVE TACTICAL MAP [M]',
    script: '/src/simulator/valles_marineris/src/valles_main.ts',
  },
  {
    path: 'frontend/src/simulator/olympus_mons/scripts/olympus-simulator.html',
    title: 'Olympus Mons (Summit Caldera) — Marswalk 3D Surface Simulation',
    status: 'Preparing Olympus Mons terrain...',
    h1: 'Olympus Mons (Summit Caldera) Surface',
    desc: 'Walk the authentic NASA PDS MGS MOLA 128 ppd digital elevation model of Olympus Mons under Martian partial gravity (0.38g · 3.71 m/s²). Explore the summit caldera floor and 21.2-km peak at the boundary of interplanetary space.',
    eyebrow: 'OLYMPUS MONS DEM · INTERACTIVE TACTICAL MAP [M]',
    script: '/src/simulator/olympus_mons/src/olympus_main.ts',
  },
];

for (const t of targets) {
  let html = sourceHtml;
  html = html.replace('<title>Jezero Crater — Marswalk 3D Surface Simulation</title>', `<title>${t.title}</title>`);
  html = html.replace('<div id="status">Preparing Jezero terrain...</div>', `<div id="status">${t.status}</div>`);
  html = html.replace('<h1>Jezero Crater Surface</h1>', `<h1>${t.h1}</h1>`);
  html = html.replace(
    /<p class="description">[\s\S]*?<\/p>/,
    `<p class="description">\n          ${t.desc}\n        </p>`
  );
  html = html.replace('aria-label="Jezero Crater Surface Navigation and Target Map"', `aria-label="${t.title} Navigation and Target Map"`);
  html = html.replace('JEZERO CRATER DEM · INTERACTIVE TACTICAL MAP [M]', t.eyebrow);
  html = html.replace('/src/simulator/jezero_crater/src/jezero_main.ts', t.script);

  fs.mkdirSync(path.dirname(t.path), { recursive: true });
  fs.writeFileSync(t.path, html, 'utf8');
  console.log(`Generated: ${t.path}`);
}
