import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTO_CHECK_INTERVAL_MS, compareVersions, createUpdater, friendlyUpdateError, latestVersionFromReleases, parseReleaseNotes, type AutoUpdaterLike, type UpdaterState } from './updater';

const RELEASES = [
  'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678 ConstrutecOrcamentos-1.0.5-full.nupkg 90000000',
  '0000000000000000000000000000000000000001 ConstrutecOrcamentos-1.0.10-full.nupkg 91000000',
  '0000000000000000000000000000000000000002 ConstrutecOrcamentos-1.0.9-delta.nupkg 1000',
].join('\r\n');
const FEED = 'https://feed.test';

function fakeAutoUpdater() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const calls: string[] = [];
  const fake: AutoUpdaterLike = {
    on: (event, listener) => { listeners.set(event, listener); return fake; },
    setFeedURL: ({ url }) => { calls.push(`feed:${url}`); },
    checkForUpdates: () => { calls.push('check'); },
    quitAndInstall: () => { calls.push('install'); },
  };
  return { fake, calls, emit: (event: string, ...args: unknown[]) => listeners.get(event)?.(...args) };
}

function build(options: { releases?: string | Error; notes?: string | Error; currentVersion?: string; supported?: boolean; last?: number; now?: number } = {}) {
  const auto = fakeAutoUpdater();
  const urls: string[] = [];
  const saved: number[] = [];
  const states: UpdaterState[] = [];
  const updater = createUpdater({
    autoUpdater: auto.fake,
    currentVersion: options.currentVersion ?? '1.0.5',
    feedUrl: FEED,
    supported: options.supported ?? true,
    now: () => options.now ?? 1_000_000_000_000,
    loadLastCheck: async () => options.last,
    saveLastCheck: async (time) => { saved.push(time); },
    onChange: (state) => states.push(state),
    fetchText: async (url) => {
      urls.push(url);
      const answer = url.endsWith('/RELEASES') ? (options.releases ?? RELEASES) : (options.notes ?? new Error('HTTP 404'));
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { updater, auto, urls, saved, states };
}

test('compareVersions compara numericamente e trata pré-lançamento', () => {
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1);
  assert.equal(compareVersions('1.0.5', '1.0.5'), 0);
  assert.equal(compareVersions('1.0.6-beta.1', '1.0.6'), -1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
});

test('latestVersionFromReleases escolhe o maior pacote completo e ignora deltas e lixo', () => {
  assert.equal(latestVersionFromReleases(RELEASES), '1.0.10');
  assert.equal(latestVersionFromReleases('texto qualquer\n\n'), undefined);
  assert.equal(latestVersionFromReleases(''), undefined);
});

test('parseReleaseNotes só aceita notas da mesma versão e limita o tamanho', () => {
  assert.equal(parseReleaseNotes(JSON.stringify({ version: '1.0.6', notes: ' Novidades ' }), '1.0.6'), 'Novidades');
  assert.equal(parseReleaseNotes(JSON.stringify({ version: '1.0.5', notes: 'x' }), '1.0.6'), undefined);
  assert.equal(parseReleaseNotes('não é json', '1.0.6'), undefined);
  assert.equal(parseReleaseNotes(JSON.stringify({ version: '1.0.6', notes: 'a'.repeat(9000) }), '1.0.6')?.length, 4000);
});

test('friendlyUpdateError traduz falhas comuns para português', () => {
  assert.match(friendlyUpdateError(new Error('HTTP 404')), /Nenhuma versão/);
  assert.match(friendlyUpdateError(new TypeError('fetch failed')), /Sem conexão/);
  assert.match(friendlyUpdateError(new Error('EPERM: operation not permitted')), /Windows bloqueou/);
  assert.match(friendlyUpdateError(new Error('qualquer coisa')), /Não foi possível concluir/);
});

test('app fora do instalador fica unsupported e não faz nenhuma chamada', async () => {
  const { updater, urls, auto } = build({ supported: false });
  assert.equal(updater.getState().phase, 'unsupported');
  await updater.check();
  updater.download();
  assert.deepEqual(urls, []);
  assert.deepEqual(auto.calls, []);
});

test('check encontra versão nova, lê as notas e registra o horário da verificação', async () => {
  const { updater, saved } = build({ notes: JSON.stringify({ version: '1.0.10', notes: 'Atualização pelo app' }) });
  const state = await updater.check();
  assert.equal(state.phase, 'available');
  assert.equal(state.availableVersion, '1.0.10');
  assert.equal(state.notes, 'Atualização pelo app');
  assert.equal(state.currentVersion, '1.0.5');
  assert.deepEqual(saved, [1_000_000_000_000]);
});

test('check segue sem notas quando latest.json não existe', async () => {
  const state = await build().updater.check();
  assert.equal(state.phase, 'available');
  assert.equal(state.notes, undefined);
});

test('check informa versão em dia quando o feed não tem nada mais novo', async () => {
  const state = await build({ currentVersion: '1.0.10' }).updater.check();
  assert.equal(state.phase, 'upToDate');
  assert.ok(state.checkedAt);
});

test('check com erro de rede vira mensagem clara e permite tentar de novo', async () => {
  const { updater } = build({ releases: new TypeError('fetch failed') });
  const state = await updater.check();
  assert.equal(state.phase, 'error');
  assert.match(state.error ?? '', /Sem conexão/);
});

test('download só vale com versão disponível, configura o feed e termina em downloaded', async () => {
  const { updater, auto } = build();
  assert.equal(updater.download().phase, 'idle');
  await updater.check();
  assert.equal(updater.download().phase, 'downloading');
  assert.deepEqual(auto.calls, [`feed:${FEED}`, 'check']);
  auto.emit('update-downloaded');
  assert.equal(updater.getState().phase, 'downloaded');
});

test('erro do autoUpdater durante o download é traduzido e libera nova tentativa', async () => {
  const { updater, auto } = build();
  await updater.check();
  updater.download();
  auto.emit('error', new Error('getaddrinfo ENOTFOUND github.com'));
  assert.equal(updater.getState().phase, 'error');
  assert.match(updater.getState().error ?? '', /Sem conexão/);
  assert.equal((await updater.check()).phase, 'available');
});

test('update-not-available durante o download é tratado como erro', async () => {
  const { updater, auto } = build();
  await updater.check();
  updater.download();
  auto.emit('update-not-available');
  assert.equal(updater.getState().phase, 'error');
});

test('install só reinicia depois do download concluído', async () => {
  const { updater, auto } = build();
  await updater.check();
  updater.install();
  assert.ok(!auto.calls.includes('install'));
  updater.download();
  auto.emit('update-downloaded');
  updater.install();
  assert.ok(auto.calls.includes('install'));
});

test('verificação não roda por cima de download em andamento', async () => {
  const { updater, urls } = build();
  await updater.check();
  updater.download();
  const before = urls.length;
  await updater.check();
  assert.equal(urls.length, before);
  assert.equal(updater.getState().phase, 'downloading');
});

test('autoCheck respeita o intervalo de 6 horas, inclusive entre aberturas do app', async () => {
  const now = 1_000_000_000_000;
  const recent = build({ last: now - AUTO_CHECK_INTERVAL_MS + 60_000, now });
  await recent.updater.autoCheck();
  assert.deepEqual(recent.urls, []);
  const stale = build({ last: now - AUTO_CHECK_INTERVAL_MS - 1, now });
  await stale.updater.autoCheck();
  assert.equal(stale.updater.getState().phase, 'available');
  const never = build({ now });
  await never.updater.autoCheck();
  assert.equal(never.updater.getState().phase, 'available');
});
