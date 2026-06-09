import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import Papa from 'papaparse';

// Regression guard for the IRT theta bounds consumed by the CAT engine
// (experimentHelpers.js builds `hyperMap` from this CSV). scores.js does not clamp
// theta itself, so this pins the source-of-truth values rather than driving clowder.
describe('PA IRT hyperparameters — composite theta bounds', () => {
  const csv = fs.readFileSync(new URL('./config/corpus/en/irt_hyperparameters.csv', import.meta.url), 'utf8');
  const rows = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
  const byType = Object.fromEntries(rows.map((r) => [r.trial_type, r]));

  it('composite_foundational bounds are pinned to -9 / 7', () => {
    const row = byType.composite_foundational;
    expect(row, 'composite_foundational row should exist').toBeDefined();
    // NOTE: bounds are intentionally asymmetric (-9 / +7) for composite_foundational,
    // unlike the symmetric (-6 / 6) rows. Confirmed intentional (introduced in 02d5c4850).
    expect(row['theta.min']).toBe(-9);
    expect(row['theta.max']).toBe(7);
  });

  it('composite (non-foundational) bounds remain symmetric -6 / 6', () => {
    const row = byType.composite;
    expect(row, 'composite row should exist').toBeDefined();
    expect(row['theta.min']).toBe(-6);
    expect(row['theta.max']).toBe(6);
  });
});
