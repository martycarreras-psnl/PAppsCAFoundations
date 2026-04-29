import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFileCommand } from '../../wizard/lib/shell.mjs';

test('Windows cmd shims are routed through cmd.exe', () => {
  const command = prepareFileCommand('C:\\Users\\dev\\AppData\\Local\\Microsoft\\PowerAppsCLI\\pac.cmd', ['auth', 'list'], {
    isWindows: true,
    comspec: 'C:\\Windows\\System32\\cmd.exe',
  });

  assert.equal(command.file, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(command.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.match(command.args[3], /^call /);
  assert.match(command.args[3], /pac\.cmd/);
  assert.match(command.args[3], /"auth"/);
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

test('Windows shell arguments escape cmd metacharacters', () => {
  const command = prepareFileCommand('C:\\Tools\\pac.cmd', ['--clientSecret', 'a&b%c^d'], {
    isWindows: true,
    comspec: 'cmd.exe',
  });

  assert.match(command.args[3], /a\^&b\^%c\^\^d/);
});