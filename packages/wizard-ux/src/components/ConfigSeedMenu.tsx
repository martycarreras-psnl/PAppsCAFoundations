import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens,
  Button, Tooltip,
  Menu, MenuTrigger, MenuPopover, MenuList, MenuItem,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Radio, RadioGroup,
  Text, Body1Strong, Caption1,
  MessageBar, MessageBarBody, MessageBarTitle,
  Spinner,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular, ArrowUploadRegular, SettingsRegular, WarningRegular,
} from '@fluentui/react-icons';
import {
  api,
  type ConfigSeed,
  type ConfigSeedImportMode,
  type ConfigSeedImportResult,
} from '../services/api';

const useStyles = makeStyles({
  list: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    margin: 0, padding: 0, listStyle: 'none',
    maxHeight: '240px', overflowY: 'auto',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', gap: '12px',
    padding: '4px 8px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  key: { color: tokens.colorNeutralForeground1, whiteSpace: 'nowrap' },
  value: {
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: '320px',
  },
  section: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' },
});

type Phase = 'idle' | 'preview' | 'applying' | 'done' | 'error';

function previewValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  if (v && typeof v === 'object') {
    const n = Object.keys(v).length;
    return `{${n} entr${n === 1 ? 'y' : 'ies'}}`;
  }
  return String(v);
}

export function ConfigSeedMenu() {
  const s = useStyles();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<ConfigSeed | null>(null);
  const [mode, setMode] = useState<ConfigSeedImportMode>('merge');
  const [result, setResult] = useState<ConfigSeedImportResult | null>(null);
  const [envWarning, setEnvWarning] = useState<string | null>(null);

  async function handleExport() {
    try {
      const { blob, filename } = await api.exportConfigSeed();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed.';
      setError(msg);
      setPhase('error');
    }
  }

  function openFilePicker() {
    setError(null);
    setResult(null);
    setSeed(null);
    setEnvWarning(null);
    fileRef.current?.click();
  }

  async function handleFileChosen(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 64 * 1024) {
      setError(`File too large (${file.size} bytes; max 65536).`);
      setPhase('error');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ConfigSeed;
      if (!parsed || typeof parsed !== 'object' || !parsed.values || typeof parsed.values !== 'object') {
        throw new Error('Not a valid PACAF wizard config — missing `values` object.');
      }
      if (parsed.version !== undefined && Number(parsed.version) > 1) {
        throw new Error(`Seed version ${parsed.version} is newer than this wizard supports.`);
      }
      setSeed(parsed);

      // Warn if env URLs in the seed differ from what's currently set
      try {
        const cur = await api.state();
        const curState = cur.state as Record<string, unknown>;
        const conflicts: string[] = [];
        for (const k of ['PP_ENV_DEV', 'PP_ENV_TEST', 'PP_ENV_PROD'] as const) {
          const a = String(curState[k] ?? '').trim();
          const b = String((parsed.values[k] as string | undefined) ?? '').trim();
          if (a && b && a !== b) conflicts.push(k);
        }
        if (conflicts.length > 0) {
          setEnvWarning(
            `This seed targets different environment URLs than the current project: ${conflicts.join(', ')}. ` +
            `Connection IDs from this seed will likely not work in your current environments.`,
          );
        }
      } catch { /* state fetch failed; skip warning */ }

      setPhase('preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not read file.';
      setError(msg);
      setPhase('error');
    }
  }

  async function applyImport() {
    if (!seed) return;
    setPhase('applying');
    try {
      const res = await api.importConfigSeed(seed, mode);
      setResult(res);
      setPhase('done');
      // Refresh state-dependent queries so the next step pre-fills with the new values.
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed.';
      setError(msg);
      setPhase('error');
    }
  }

  function closeDialog() {
    setPhase('idle');
    setSeed(null);
    setResult(null);
    setError(null);
    setEnvWarning(null);
    setMode('merge');
  }

  const dialogOpen = phase === 'preview' || phase === 'applying' || phase === 'done' || phase === 'error';

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileChosen}
      />

      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Tooltip relationship="label" content="Configuration">
            <Button appearance="subtle" icon={<SettingsRegular />} aria-label="Configuration" />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<ArrowDownloadRegular />} onClick={handleExport}>
              Export configuration…
            </MenuItem>
            <MenuItem icon={<ArrowUploadRegular />} onClick={openFilePicker}>
              Import configuration…
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <Dialog open={dialogOpen} onOpenChange={(_, d) => { if (!d.open) closeDialog(); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {phase === 'done' ? 'Configuration imported'
                : phase === 'error' ? 'Import failed'
                : 'Import configuration'}
            </DialogTitle>
            <DialogContent>
              {phase === 'preview' && seed && (
                <ImportPreview
                  seed={seed}
                  mode={mode}
                  onModeChange={setMode}
                  envWarning={envWarning}
                  styles={s}
                />
              )}
              {phase === 'applying' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner size="tiny" /> <Text>Writing configuration…</Text>
                </div>
              )}
              {phase === 'done' && result && (
                <ImportResult result={result} styles={s} />
              )}
              {phase === 'error' && (
                <MessageBar intent="error">
                  <MessageBarBody>
                    <MessageBarTitle>Import failed</MessageBarTitle>
                    {error}
                  </MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              {phase === 'preview' && (
                <>
                  <Button appearance="secondary" onClick={closeDialog}>Cancel</Button>
                  <Button appearance="primary" onClick={applyImport}>Apply</Button>
                </>
              )}
              {(phase === 'done' || phase === 'error') && (
                <Button appearance="primary" onClick={closeDialog}>Close</Button>
              )}
              {phase === 'applying' && (
                <Button appearance="secondary" disabled>Working…</Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function ImportPreview({
  seed, mode, onModeChange, envWarning, styles,
}: {
  seed: ConfigSeed;
  mode: ConfigSeedImportMode;
  onModeChange: (m: ConfigSeedImportMode) => void;
  envWarning: string | null;
  styles: ReturnType<typeof useStyles>;
}) {
  const entries = Object.entries(seed.values);
  const hasOpRefs = 'OP_VAULT' in seed.values || 'OP_ITEM' in seed.values;
  return (
    <div className={styles.section}>
      <MessageBar intent="info">
        <MessageBarBody>
          Secrets are never included. App Registration secrets remain in 1Password or
          <code> .env.local</code> — only references to them ship in this file.
        </MessageBarBody>
      </MessageBar>

      {hasOpRefs && (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>1Password references imported</MessageBarTitle>
            This seed includes <code>OP_VAULT</code> / <code>OP_ITEM</code> pointers.
            You'll still need access to that vault on this machine to retrieve the actual secret.
          </MessageBarBody>
        </MessageBar>
      )}

      {envWarning && (
        <MessageBar intent="warning" icon={<WarningRegular />}>
          <MessageBarBody>
            <MessageBarTitle>Environment mismatch</MessageBarTitle>
            {envWarning}
          </MessageBarBody>
        </MessageBar>
      )}

      <Body1Strong>Values in this seed ({entries.length})</Body1Strong>
      <ul className={styles.list}>
        {entries.map(([k, v]) => (
          <li key={k} className={styles.row}>
            <span className={styles.key}>{k}</span>
            <span className={styles.value} title={previewValue(v)}>{previewValue(v)}</span>
          </li>
        ))}
        {entries.length === 0 && <Caption1>(empty)</Caption1>}
      </ul>

      <Body1Strong>How to apply</Body1Strong>
      <RadioGroup value={mode} onChange={(_, d) => onModeChange(d.value as ConfigSeedImportMode)}>
        <Radio value="merge" label="Merge (recommended) — only fill values that are currently empty" />
        <Radio value="replace-allowlisted" label="Overwrite — replace existing values with values from the seed" />
      </RadioGroup>
    </div>
  );
}

function ImportResult({ result, styles }: { result: ConfigSeedImportResult; styles: ReturnType<typeof useStyles> }) {
  return (
    <div className={styles.section}>
      <MessageBar intent="success">
        <MessageBarBody>
          <MessageBarTitle>Done</MessageBarTitle>
          {result.written.length} value{result.written.length === 1 ? '' : 's'} written,
          {' '}{result.preserved.length} preserved,
          {' '}{result.skipped.length} skipped.
        </MessageBarBody>
      </MessageBar>

      {result.written.length > 0 && (
        <>
          <Body1Strong>Written</Body1Strong>
          <ul className={styles.list}>
            {result.written.map((w) => (
              <li key={w.key} className={styles.row}><span className={styles.key}>{w.key}</span></li>
            ))}
          </ul>
        </>
      )}

      {result.preserved.length > 0 && (
        <>
          <Body1Strong>Preserved (already set)</Body1Strong>
          <ul className={styles.list}>
            {result.preserved.map((p) => (
              <li key={p.key} className={styles.row}>
                <span className={styles.key}>{p.key}</span>
                <span className={styles.value}>{p.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.skipped.length > 0 && (
        <>
          <Body1Strong>Skipped</Body1Strong>
          <ul className={styles.list}>
            {result.skipped.map((sk) => (
              <li key={sk.key} className={styles.row}>
                <span className={styles.key}>{sk.key}</span>
                <span className={styles.value}>{sk.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
