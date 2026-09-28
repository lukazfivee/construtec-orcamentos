import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposalFromHash } from './useProposalDeepLink';

test('link direto #proposta= aceita so ids validos, com ou sem handoff junto', () => {
  const id = '86893454-903d-4d6a-ac81-267d8044b312';
  assert.equal(proposalFromHash(`#proposta=${id}`), id);
  assert.equal(proposalFromHash(`#handoff=${'a'.repeat(43)}&proposta=${id}`), id);
  assert.equal(proposalFromHash('#proposta=../../x'), null);
  assert.equal(proposalFromHash('#proposta=<script>'), null);
  assert.equal(proposalFromHash('#obra=12'), null);
  assert.equal(proposalFromHash(''), null);
});
