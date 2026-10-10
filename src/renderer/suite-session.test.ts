import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suiteSessionFromHash } from './suiteSession';

test('#sessao= da Suite aceita so token de sessao do Centro, com ou sem proposta junto', () => {
  const token = 'Zm9vYmFyLy8rK3Rva2VuMTIzNDU2Nzg5MDEyMzQ1Ng';
  assert.equal(suiteSessionFromHash(`#sessao=${encodeURIComponent(token)}`), token);
  assert.equal(suiteSessionFromHash(`#sessao=${encodeURIComponent('ab+/cd+/ef+/gh+/ij+/kl+/mn')}&proposta=x`), 'ab+/cd+/ef+/gh+/ij+/kl+/mn');
  assert.equal(suiteSessionFromHash('#sessao=curto'), null);
  assert.equal(suiteSessionFromHash(`#sessao=${'a'.repeat(300)}`), null);
  assert.equal(suiteSessionFromHash('#sessao=<script>alert(1)</script>aaaaaaaaaaaa'), null);
  assert.equal(suiteSessionFromHash(`#handoff=${'a'.repeat(43)}`), null);
  assert.equal(suiteSessionFromHash(''), null);
});
