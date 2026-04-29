import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstCommandPath,
  formatCommandForLog,
  prepareFileCommand,
  quoteWindowsCmdCommand,
  resolveWindowsCommandShim,
} from '../../wizard/lib/shell.mjs';

test('Windows cmd shims are routed through cmd.exe', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', ['auth', 'list'], {
    isWindows: true,
    comspec: 'C:\\Windows\\System32\\cmd.exe',
  });

  assert.equal(command.file, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(command.args, ['/d', '/s', '/c', '""pac" "auth" "list""']);
  assert.equal(command.shellShim, true);
});

test('Windows exe commands stay direct', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\.dotnet\\tools\\pac.exe', ['org', 'who'], {
    isWindows: true,
    comspec: 'cmd.exe',
  });

  assert.equal(command.file, 'C:\\Users\\dev\\.dotnet\\tools\\pac.exe');
  assert.deepEqual(command.args, ['org', 'who']);
  assert.equal(command.shellShim, false);
});

test('non-Windows command shims stay direct', () => {
  const command = prepareFileCommand('/tmp/pac.cmd', ['auth', 'list'], {
    isWindows: false,
    comspec: 'cmd.exe',
  });

  assert.equal(command.file, '/tmp/pac.cmd');
  assert.deepEqual(command.args, ['auth', 'list']);
  assert.equal(command.shellShim, false);
});

test('Windows shell fallback quotes arguments for cmd execution', () => {
  const command = prepareFileCommand('C:\\Tools\\pac.cmd', ['code', 'init', '--displayName', 'Windows Hello'], {
    isWindows: true,
    comspec: 'cmd.exe',
  });

  assert.deepEqual(command.args, ['/d', '/s', '/c', '""pac" "code" "init" "--displayName" "Windows Hello""']);
});

test('Windows command quoting escapes cmd metacharacters', () => {
  const commandLine = quoteWindowsCmdCommand('pac', ['auth', 'create', '--clientSecret', 'a&b%c^d']);

  assert.equal(commandLine, '""pac" "auth" "create" "--clientSecret" "a^&b%%c^^d""');
});

test('command logging quotes arguments with spaces', () => {
  const logged = formatCommandForLog('pac.cmd', ['code', 'init', '--displayName', 'Windows Hello']);

  assert.equal(logged, 'pac.cmd code init --displayName "Windows Hello"');
});

test('Windows cmd shims prefer sibling exe when present', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', ['auth', 'list'], {
    isWindows: true,
    comspec: 'cmd.exe',
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