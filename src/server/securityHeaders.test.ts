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
  for (const route of ['/api/proposals', '/api/dashboard', '/api/public/c/abc', '/health']) {
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
  const regras = readFileSync(path.join(process.cwd(), 'public', '_headers'), 'utf8');
  assert.match(regras, /^\/\*\s*\n(?:\s+.+\n)*?\s+Content-Security-Policy: frame-ancestors 'self'/m);
  assert.match(regras, /X-Content-Type-Options: nosniff/);
});