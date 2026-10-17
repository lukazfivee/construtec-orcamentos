import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { securityHeaders } from './securityHeaders';

const run = (route: string) => {
  const headers: Record<string, string> = {};
  let passed = false;
  const response = { setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; } } as unknown as Response;
  securityHeaders({ path: route } as Request, response, () => { passed = true; });
  return { headers, passed };
};

test('API e health saem sem cache e com nosniff', () => {
  for (const route of ['/api/proposals', '/api/dashboard', '/api/public/c/abc', '/health', '/API/PROPOSALS', '/Api/Dashboard', '/HEALTH']) {
    const { headers, passed } = run(route);
    assert.equal(passed, true, route);
    assert.equal(headers['cache-control'], 'no-store', route);
    assert.equal(headers['x-content-type-options'], 'nosniff', route);
  }
});

test('fora da API so o nosniff (arquivos estaticos tem o proprio cache)', () => {
  const { headers } = run('/m/m.css');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['cache-control'], undefined);
});
test('arquivos estaticos: nenhuma tela pode ser embutida em outro site', () => {
  const linhas = readFileSync(path.join(process.cwd(), 'public', '_headers'), 'utf8').split(/\r?\n/);
  const inicio = linhas.indexOf('/*');
  assert.notEqual(inicio, -1, 'regra geral /* ausente em public/_headers');
  // Cabecalhos da regra: as linhas indentadas logo abaixo, ate a proxima regra.
  const regra: string[] = [];
  for (const linha of linhas.slice(inicio + 1)) { if (!/^\s+\S/.test(linha)) break; regra.push(linha.trim()); }
  const csp = regra.find((linha) => linha.startsWith('Content-Security-Policy:')) ?? '';
  assert.match(csp, /frame-ancestors 'self'/, regra.join(' | '));
  // O Orcamentos embutido no Centro e um fluxo suportado: o Centro tem de estar na lista, e nenhum curinga.
  assert.ok(csp.includes('https://centro-custos-api.construtec-reports.workers.dev'), csp);
  assert.doesNotMatch(csp, /\*|http:/, csp);
  assert.ok(regra.includes('X-Content-Type-Options: nosniff'), regra.join(' | '));
});