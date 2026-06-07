import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const defaultHost = '192.168.20.18';
const certHost =
  process.env.PHONE_CERT_HOST ??
  process.argv.slice(2).find((arg) => !arg.startsWith('-')) ??
  defaultHost;

const certDir = join(process.cwd(), 'certificates');
const certFile = join(certDir, 'dev-local.pem');
const keyFile = join(certDir, 'dev-local-key.pem');
const rootCaFile = join(certDir, 'rootCA.pem');

function canRun(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function findMkcertRunner() {
  const mkcertBin = process.env.MKCERT_BIN;

  if (mkcertBin) {
    return { command: mkcertBin, type: 'direct' };
  }

  if (canRun('mkcert', ['-version'])) {
    return { command: 'mkcert', type: 'direct' };
  }

  if (canRun('nix-shell', ['--version'])) {
    return { command: 'nix-shell', type: 'nix-shell' };
  }

  throw new Error(
    [
      'mkcert was not found.',
      'Install mkcert and make it available on PATH, or set MKCERT_BIN to its executable path.',
      'On NixOS, install nix-shell support or run this inside a shell that provides mkcert.',
    ].join('\n'),
  );
}

function runMkcert(runner, args, { captureStdout = false } = {}) {
  const command = runner.type === 'nix-shell' ? 'nix-shell' : runner.command;
  const commandArgs =
    runner.type === 'nix-shell'
      ? ['-p', 'mkcert', '--run', `mkcert ${args.map(shellQuote).join(' ')}`]
      : args;
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`mkcert exited with code ${result.status ?? 'unknown'}.`);
  }

  return captureStdout ? result.stdout.trim() : '';
}

const names = Array.from(new Set([certHost, 'localhost', '127.0.0.1', '::1']));
const runner = findMkcertRunner();

mkdirSync(certDir, { recursive: true });

runMkcert(runner, ['-cert-file', certFile, '-key-file', keyFile, ...names]);

const caRoot = runMkcert(runner, ['-CAROOT'], { captureStdout: true });
copyFileSync(join(caRoot, 'rootCA.pem'), rootCaFile);

console.log('');
console.log(`Generated certificate for ${names.join(', ')}.`);
console.log(`Certificate: ${certFile}`);
console.log(`Key: ${keyFile}`);
console.log(`iPhone root CA: ${rootCaFile}`);
