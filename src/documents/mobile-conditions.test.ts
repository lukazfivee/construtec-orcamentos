import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseCommercialConditions } from './proposalDocumentCommon';

// O celular (public/m/prop-cond.js) le e grava as condicoes comerciais no mesmo JSON do computador. O leitor do
// celular tem de dar o mesmo resultado de parseCommercialConditions, inclusive para o texto antigo sem JSON.
type MobileOC = {
  parseConditions: (scope: string) => ReturnType<typeof parseCommercialConditions>;
  conditionTerms: (scope: string, withNotes: boolean) => Array<[string, string]>;
  extendDate: (current: string | null, days: number) => string;
};
const loadMobile = (): MobileOC => {
  const code = readFileSync(path.join(process.cwd(), 'public', 'm', 'prop-cond.js'), 'utf8');
  const sandbox = { window: {} as { OC?: MobileOC } };
  vm.runInNewContext(code, sandbox);
  assert.ok(sandbox.window.OC, 'prop-cond.js nao definiu window.OC');
  return sandbox.window.OC;
};

test('/m/: leitor de condicoes igual ao do computador (JSON, texto antigo e vazio)', () => {
  const oc = loadMobile();
  const samples = [
    JSON.stringify({ scope: 'CFTV do bloco B', executionTerm: '15 dias úteis', paymentTerms: '40% entrada', warranty: '90 dias', notes: 'Sem obra civil' }),
    JSON.stringify({ scope: '  ', executionTerm: ' 10 dias ' }),
    JSON.stringify({ executionTerm: 'sem escopo' }),
    'Escopo: Rede lógica\nPrazo de execução: 20 dias\nForma de pagamento: à vista\nGarantia: 1 ano\nObservações: nada',
    'Proposta para Hospital São Lucas',
    '',
    '123',
  ];
  for (const scope of samples) assert.deepEqual({ ...oc.parseConditions(scope) }, parseCommercialConditions(scope), scope);
});

test('/m/: condicoes do PDF usam os textos de reserva do documento do servidor', () => {
  const oc = loadMobile();
  const terms = Array.from(oc.conditionTerms('Proposta para Obra X', true), (row) => [...row]);
  assert.deepEqual(terms, [
    ['Forma de pagamento', 'A combinar com o cliente'],
    ['Prazo de execução', 'A combinar após o aceite da proposta'],
    ['Garantia', 'Conforme normas técnicas aplicáveis'],
  ]);
  const filled = Array.from(oc.conditionTerms(JSON.stringify({ scope: 'x', paymentTerms: 'À vista', notes: 'Obs' }), true), (row) => [...row]);
  assert.deepEqual(filled[0], ['Forma de pagamento', 'À vista']);
  assert.deepEqual(filled[3], ['Observações', 'Obs']);
  assert.equal(oc.conditionTerms(JSON.stringify({ scope: 'x', notes: 'Obs' }), false).length, 3);
});

test('/m/: prorrogar soma a partir da validade atual ou de hoje, a que for mais tarde', () => {
  const oc = loadMobile();
  assert.equal(oc.extendDate('2999-01-10', 15), '2999-01-25');
  const today = new Date();
  today.setDate(today.getDate() + 7);
  const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert.equal(oc.extendDate('2000-01-01', 7), expected);
  assert.equal(oc.extendDate(null, 7), expected);
});
