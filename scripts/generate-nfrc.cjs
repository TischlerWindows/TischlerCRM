#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataFile = path.join(os.tmpdir(), 'nfrc_complete.txt');
const outFile = path.join(__dirname, '..', 'packages', 'proposal-assembly', 'src', 'nfrc-data.ts');

const catMap = {
  CW: 'curtainWall', DH: 'doubleHung', FS: 'fixedSimulation',
  IE: 'isEntryDoor', TT: 'isTiltAndTurn', LR: 'liftRollingDoor',
  OC: 'osCasement', OE: 'osEntryDoor',
};
const catOrder = ['curtainWall','doubleHung','fixedSimulation','isEntryDoor','isTiltAndTurn','liftRollingDoor','osCasement','osEntryDoor'];

// catData: cat -> Map(glassNum -> { noGrid, grid })
const catData = {};
for (const c of catOrder) catData[c] = new Map();

const round2 = v => { const n = parseFloat(v); return isNaN(n) ? null : n.toFixed(2); };
const round1 = v => { const n = parseFloat(v); return isNaN(n) ? null : n.toFixed(1); };
const formatIgu = s => { if (!s || !s.trim()) return ''; const t = s.trim(); if (/^[\d.]+$/.test(t)) { const r = round1(t); return r || t; } return t; };

const rawFile = fs.readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
const lines = rawFile.split('\n');
let currentCat = null;
for (const raw of lines) {
  const line = raw.replace(/\r$/, '');
  const secMatch = line.match(/^=== (\w+) ===/);
  if (secMatch) { currentCat = catMap[secMatch[1]] || null; continue; }
  if (!currentCat) continue;
  const cols = line.split('|');
  if (cols.length < 7) continue;
  const gRaw = cols[1].trim();
  if (!gRaw || !/^#\d/.test(gRaw)) continue;
  const gNum = gRaw.replace(/^#/, '');
  const gGrid = cols[3].trim();
  const uRaw = cols[4].trim(); const sRaw = cols[5].trim();
  const iguRaw = cols[6].trim(); const coatRaw = cols.length > 7 ? cols[7].trim() : '';
  
  const uVal = (uRaw && uRaw !== '#REF!') ? (round2(uRaw) || '0.00') : '0.00';
  const sVal = (sRaw && sRaw !== '#REF!') ? (round2(sRaw) || 'N/A') : 'N/A';
  const iguVal = formatIgu(iguRaw);
  const coatVal = coatRaw || 'None';
  
  if (!catData[currentCat].has(gNum)) catData[currentCat].set(gNum, { noGrid: null, grid: null });
  const entry = catData[currentCat].get(gNum);
  const row = { u: uVal, s: sVal, igu: iguVal, coat: coatVal };
  if (gGrid === 'No Grid') entry.noGrid = row;
  else if (gGrid.includes('Grid')) entry.grid = row;
}

// Report counts
for (const c of catOrder) console.log(`${c}: ${catData[c].size} glass types`);

// Generate TypeScript
const esc = s => s.replace(/'/g, "\\'");
const lines2 = [
  '// AUTO-GENERATED NFRC lookup table — do not edit manually.',
  '// Source: NFRC 100/200/500 Summary Sheets (8 product categories).',
  '',
  'export interface NfrcRow { u: string; s: string; igu: string; coat: string }',
  'export interface NfrcEntry { noGrid: NfrcRow; grid: NfrcRow }',
  '',
  '// Record<categoryKey, Record<glassNum, NfrcEntry>>',
  'export const NFRC_DATA: Record<string, Record<string, NfrcEntry>> = {',
];

for (const cat of catOrder) {
  lines2.push(`  ${cat}: {`);
  for (const [gNum, entry] of catData[cat]) {
    const ng = entry.noGrid || { u: '0.00', s: 'N/A', igu: '', coat: 'None' };
    const gr = entry.grid || { u: '0.00', s: 'N/A', igu: '', coat: 'None' };
    lines2.push(`    '${esc(gNum)}': { noGrid: { u: '${esc(ng.u)}', s: '${esc(ng.s)}', igu: '${esc(ng.igu)}', coat: '${esc(ng.coat)}' }, grid: { u: '${esc(gr.u)}', s: '${esc(gr.s)}', igu: '${esc(gr.igu)}', coat: '${esc(gr.coat)}' } },`);
  }
  lines2.push('  },');
}
lines2.push('};', '');

fs.writeFileSync(outFile, lines2.join('\n'), 'utf8');
console.log(`Written: ${outFile} (${lines2.length} lines)`);
