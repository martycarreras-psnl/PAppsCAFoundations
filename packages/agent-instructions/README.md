# Agent guidance sync and project policy

`pacaf-instructions sync` installs packaged guidance; `check` checks both the
package version and actual file contents. Exit codes are 0 (current/success),
2 (drift), and 1 (missing installation or failure).

## Explicit local policy overlays

Keep intentional project-specific replacements outside the shipped paths:

```json
{
  "version": 1,
  "files": {
    "AGENTS.md": ".pacaf/policy/AGENTS.md",
    ".github/copilot-instructions.md": ".pacaf/policy/copilot-instructions.md"
  }
}
```

Save this manifest as `.pacaf/policy-overlays.json`, and commit it together with
the referenced files. Each entry replaces **the entire destination file**, not
just a paragraph. Destinations must be files provided by this package; sources
must remain under `.pacaf/policy/`. Symlinks and path traversal are refused.
Review upstream changes periodically and incorporate compatible policy changes
into your replacements. An overlay deliberately takes precedence over upstream
policy and may otherwise hide newer guidance.

Sync records installed content hashes in `.foundations-version.json`. Direct,
unregistered changes to installed guidance cause sync to stop before overwriting
anything. Move those intentional edits into an overlay first. On older
installations without hashes, differing existing files are conservatively
treated as local edits. `sync --force` explicitly replaces these files, but first
saves their original bytes under `.pacaf/guidance-backups/<run>/`; it does not
delete the backup. Review these backups before committing them (local guidance
may contain project-sensitive information).

If a copy fails midway, sync attempts to restore the preceding guidance and
version stamp, then reapplies explicit overlays. Recovery errors are reported
and return nonzero; failed sync never records a successful new version.

## Code App CLI policy migration gate

Existing Code Apps must explicitly migrate before receiving the new Power Apps
CLI guidance. Sync requires the exact devDependency
`"@microsoft/power-apps-cli": "1.0.2"` and no remaining legacy `pac code`
lifecycle scripts (including PAC wrapper scripts). Merely installing newer
Foundations packages is not migration. Run `pacaf-migrate-pa --help`, review its
dry-run, and apply the migration before retrying sync. `--force` cannot bypass
this gate. Empty starter directories can still receive initial guidance.

If you deliberately retain a different CLI policy, set
`"codeAppCliPolicy": "reviewed-local"` in the overlay manifest **and** provide
replacement overlays for every shipped file containing Power Apps CLI policy
(canonical instructions, root guidance, and native-agent projections). This is
an explicit reviewed-policy exception, not a switch to ignore incompatibility.
An incomplete overlay set is refused; new upstream CLI-policy files require
review and an added overlay before subsequent sync.
