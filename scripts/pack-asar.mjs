import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import asar from '../../node_modules/@electron/asar/lib/asar.js';

const projectRoot = path.resolve('.');
const stagingDir = path.join(projectRoot, '.app-staging');
const targetAsar = path.resolve('../out/ConstrutecOrcamentos-win32-x64/resources/app.asar');

console.log('Criando staging para app.asar...');
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

// 1. Copiar package.json
cpSync(path.join(projectRoot, 'package.json'), path.join(stagingDir, 'package.json'));

// 2. Copiar .vite (build e renderer)
cpSync(path.join(projectRoot, '.vite'), path.join(stagingDir, '.vite'), { recursive: true });

console.log('Empacotando app.asar atualizado em:', targetAsar);
await asar.createPackage(stagingDir, targetAsar);

rmSync(stagingDir, { recursive: true, force: true });
console.log('app.asar gerado com sucesso!');

// 3. Se existir instalação no AppData Local, atualizar também
const localAppDataAsar = path.join(
  process.env.LOCALAPPDATA || '',
  'ConstrutecOrcamentos',
  'app-1.0.2',
  'resources',
  'app.asar'
);
try {
  cpSync(targetAsar, localAppDataAsar);
  console.log('app.asar sincronizado com a instalação local:', localAppDataAsar);
} catch {
  // Se não existir ou estiver em uso, ignorar silenciosamente
}
