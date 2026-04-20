import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const functionSource = readFileSync(
  'C:/PROYECTOS/factos-ng/supabase/functions/padron-lookup/index.ts',
  'utf8'
);

const flowDoc = readFileSync('C:/PROYECTOS/factos-ng/docs/flujos-clave.md', 'utf8');

describe('padron-lookup production surface', () => {
  it('does not keep a diagnostic debug branch in the edge function', () => {
    expect(functionSource).not.toMatch(/\bdebug\b/);
    expect(functionSource).not.toContain('captureDiagnosticCall');
    expect(functionSource).not.toContain('inspectStoredPadronTicket');
  });

  it('does not document a debug mode for padron-lookup', () => {
    expect(flowDoc).not.toContain('debug: true');
    expect(flowDoc).not.toContain('Modo diagnóstico');
  });
});
