import { createRequire } from 'node:module';
import {
  existsSync,
  rmSync,
  statSync,
  copyFileSync,
  readdirSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const winstaller = require(path.resolve('../node_modules/electron-winstaller'));

const projectRoot = path.resolve('.');
const originalAppDir = path.resolve('../out/ConstrutecOrcamentos-win32-x64');
const finalOutputDir = path.resolve('../out/make/squirrel.windows/x64');

console.log('=== Iniciando Geração do Instalador Windows Construtec Orçamentos ===');

// 1. Limpeza de arquivos residuais na pasta empacotada
console.log('1. Otimizando pasta do aplicativo empacotado...');
if (existsSync(originalAppDir)) {
  const files = readdirSync(originalAppDir);
  for (const f of files) {
    if (f.endsWith('.bak') || f.endsWith('.log') || f.endsWith('.lnk')) {
      const target = path.join(originalAppDir, f);
      console.log(`   Removendo arquivo residual: ${f}`);
      rmSync(target, { force: true });
    }
  }
} else {
  throw new Error(`Diretório do aplicativo não encontrado: ${originalAppDir}`);
}

// 2. Validação dos componentes essenciais
console.log('2. Verificando componentes essenciais...');
const asarPath = path.join(originalAppDir, 'resources', 'app.asar');
const pglitePath = path.join(originalAppDir, 'resources', 'pglite');
const exePath = path.join(originalAppDir, 'ConstrutecOrcamentos.exe');

if (!existsSync(asarPath)) throw new Error('app.asar não encontrado em resources!');
if (!existsSync(pglitePath)) throw new Error('runtime pglite não encontrado em resources!');
if (!existsSync(exePath)) throw new Error('ConstrutecOrcamentos.exe não encontrado!');

console.log(`   ✓ Executável principal: ${exePath}`);
console.log(`   ✓ Recursos app.asar: ${(statSync(asarPath).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   ✓ Banco de dados embarcado pglite: presente`);

// 3. Preparando ponte de caminhos ASCII para contornar limitação do rcedit com acentos
console.log('3. Preparando ponte de caminhos temporários ASCII (evita falha com caracteres especiais)...');
const tempRoot = path.join(os.tmpdir(), `construtec-build-${Date.now()}`);
const stagedAppDir = path.join(tempRoot, 'app');
const stagedOutputDir = path.join(tempRoot, 'out');

mkdirSync(tempRoot, { recursive: true });
mkdirSync(stagedOutputDir, { recursive: true });
symlinkSync(originalAppDir, stagedAppDir, 'junction');

// Staging splash e ícone para substituir o splash verde padrão do Squirrel pelo logo da Construtec
const localSplash = path.resolve('src/assets/install-splash.gif');
const localIcon = path.resolve('src/assets/app-icon.ico');
const stagedSplash = path.join(tempRoot, 'install-splash.gif');
const stagedIcon = path.join(tempRoot, 'app-icon.ico');

if (existsSync(localSplash)) copyFileSync(localSplash, stagedSplash);
if (existsSync(localIcon)) copyFileSync(localIcon, stagedIcon);

console.log(`   ✓ Staging App: ${stagedAppDir}`);
console.log(`   ✓ Staging Output: ${stagedOutputDir}`);
if (existsSync(stagedSplash)) console.log(`   ✓ Splash oficial Construtec configurado: ${stagedSplash}`);
if (existsSync(stagedIcon)) console.log(`   ✓ Ícone oficial Construtec configurado: ${stagedIcon}`);

// 4. Executando electron-winstaller
console.log('4. Empacotando instalador com Squirrel.Windows (electron-winstaller)...');
console.log('   Compactando pacote NuGet e gerando Setup.exe personalizado...');

const startTime = Date.now();
try {
  const installerOptions = {
    appDirectory: stagedAppDir,
    outputDirectory: stagedOutputDir,
    exe: 'ConstrutecOrcamentos.exe',
    setupExe: 'Construtec-Orcamentos-1.0.5-Setup.exe',
    title: 'Construtec Orçamentos',
    authors: 'Construtec Engenharia',
    description: 'Orçamentos profissionais, rápidos, seguros e offline para a Construtec Engenharia.',
    noMsi: true,
  };
  if (existsSync(stagedSplash)) {
    installerOptions.loadingGif = stagedSplash;
  }
  if (existsSync(stagedIcon)) {
    installerOptions.setupIcon = stagedIcon;
  }

  await winstaller.createWindowsInstaller(installerOptions);

  const elapsedSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`✓ Pacote Squirrel gerado com sucesso em ${elapsedSec}s!`);

  // 5. Transferir arquivos gerados para a pasta final do projeto
  console.log('5. Sincronizando instalador para a pasta de distribuição do projeto...');
  mkdirSync(finalOutputDir, { recursive: true });

  const generatedFiles = readdirSync(stagedOutputDir);
  for (const file of generatedFiles) {
    const src = path.join(stagedOutputDir, file);
    const dest = path.join(finalOutputDir, file);
    copyFileSync(src, dest);
    console.log(`   ✓ Sincronizado: ${file} (${(statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Garantir atalho Setup.exe para compatibilidade
  const namedSetup = path.join(finalOutputDir, 'Construtec-Orcamentos-1.0.5-Setup.exe');
  const genericSetup = path.join(finalOutputDir, 'Setup.exe');
  if (existsSync(namedSetup) && !existsSync(genericSetup)) {
    copyFileSync(namedSetup, genericSetup);
  }

  const finalSetup = existsSync(namedSetup) ? namedSetup : genericSetup;
  const setupStats = statSync(finalSetup);
  const sizeMb = (setupStats.size / 1024 / 1024).toFixed(2);

  console.log('\n=== INSTALADOR WINDOWS GERADO COM SUCESSO! ===');
  console.log(`Arquivo Oficial: ${finalSetup}`);
  console.log(`Tamanho: ${sizeMb} MB`);
  console.log(`Pasta: ${finalOutputDir}`);
  console.log('==============================================\n');
} finally {
  try {
    unlinkSync(stagedAppDir);
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {}
}
