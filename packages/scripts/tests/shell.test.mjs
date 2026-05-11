import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstCommandPath,
  formatCommandForLog,
  prepareFileCommand,
  resolveWindowsCommandShim,
} from '../../wizard/lib/shell.mjs';

test('Windows cmd shims are executed via Node shell:true', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', ['auth', 'list'], {
    isWindows: true,
  });

  assert.equal(command.file, 'C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd');
  assert.deepEqual(command.args, ['auth', 'list']);
  assert.equal(command.shell, true);
  assert.equal(command.shellShim, true);
});

test('Windows exe commands stay direct', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\.dotnet\\tools\\pac.exe', ['org', 'who'], {
    isWindows: true,
  });

  assert.equal(command.file, 'C:\\Users\\dev\\.dotnet\\tools\\pac.exe');
  assert.deepEqual(command.args, ['org', 'who']);
  assert.equal(command.shell, false);
  assert.equal(command.shellShim, false);
});

test('non-Windows command shims stay direct', () => {
  const command = prepareFileCommand('/tmp/pac.cmd', ['auth', 'list'], {
    isWindows: false,
  });

  assert.equal(command.file, '/tmp/pac.cmd');
  assert.deepEqual(command.args, ['auth', 'list']);
  assert.equal(command.shell, false);
  assert.equal(command.shellShim, false);
});

test('Windows cmd shim pre-quotes arguments containing spaces', () => {
  const command = prepareFileCommand('C:\\Tools\\pac.cmd', ['code', 'init', '--displayName', 'Hello Windows'], {
    isWindows: true,
  });

  // File path has no spaces, so it stays unquoted; arg with a space gets wrapped.
  assert.equal(command.file, 'C:\\Tools\\pac.cmd');
  assert.deepEqual(command.args, ['code', 'init', '--displayName', '"Hello Windows"']);
  assert.equal(command.shell, true);
});

test('Windows cmd shim leaves URL arguments unquoted', () => {
  const command = prepareFileCommand('C:\\Tools\\pac.cmd', [
    'auth', 'create',
    '--environment', 'https://carremacodeapps.crm.dynamics.com',
    '--applicationId', '00000000-0000-0000-0000-000000000000',
  ], {
    isWindows: true,
  });

  assert.equal(command.file, 'C:\\Tools\\pac.cmd');
  assert.deepEqual(command.args, [
    'auth', 'create',
    '--environment', 'https://carremacodeapps.crm.dynamics.com',
    '--applicationId', '00000000-0000-0000-0000-000000000000',
  ]);
  assert.equal(command.shell, true);
});

test('Windows cmd shim quotes file path containing spaces', () => {
  const command = prepareFileCommand('C:\\Program Files\\Custom\\pac.cmd', ['org', 'who'], {
    isWindows: true,
  });

  assert.equal(command.file, '"C:\\Program Files\\Custom\\pac.cmd"');
  assert.deepEqual(command.args, ['org', 'who']);
});

test('Windows cmd shim doubles embedded quotes', () => {
  const command = prepareFileCommand('C:\\Tools\\pac.cmd', ['auth', 'create', '--clientSecret', 'a"b c'], {
    isWindows: true,
  });

  assert.deepEqual(command.args, ['auth', 'create', '--clientSecret', '"a""b c"']);
});

test('command logging quotes arguments with spaces', () => {
  const logged = formatCommandForLog('pac.cmd', ['code', 'init', '--displayName', 'Windows Hello']);

  assert.equal(logged, 'pac.cmd code init --displayName "Windows Hello"');
});

test('Windows cmd shims prefer sibling exe when present', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', ['auth', 'list'], {
    isWindows: true,
  });
  const resolved = resolveWindowsCommandShim('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', {
    isWindows: true,
    existsImpl: (path) => path.endsWith('pac.exe'),
  });

  assert.equal(resolved, 'C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.exe');
  assert.equal(command.shellShim, true);
});

test('command lookup output is normalized from Windows CRLF lines', () => {
  const path = firstCommandPath('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd\r\nC:\\Other\\pac.cmd\r\n');

  assert.equal(path, 'C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd');
  assert.equal(path.includes('\r'), false);
});
