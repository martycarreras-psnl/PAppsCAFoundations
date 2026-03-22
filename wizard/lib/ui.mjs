// wizard/lib/ui.mjs — Cross-platform UI helpers using chalk
import chalk from 'chalk';

export function banner() {
  console.log('');
  console.log(chalk.cyan('════════════════════════════════════════════════════'));
  console.log(chalk.cyan('  Power Apps Code Apps — Setup Wizard'));
  console.log(chalk.cyan('════════════════════════════════════════════════════'));
  console.log('');
  console.log('  This wizard walks you through everything needed');
  console.log('  to create and deploy a Power Apps Code App.');
  console.log('');
  console.log('  You\'ll need:');
  console.log('    • A browser (for Power Apps Maker Portal & Admin Center steps)');
  console.log('    • Your Azure AD credentials');
  console.log('    • Access to Power Platform admin center');
  console.log('');
  console.log('  You can quit anytime with Ctrl+C and re-run later.');
  console.log('  The wizard remembers where you left off.');
  console.log('');
}

export function stepHeader(num, total, title) {
  console.log('');
  console.log(chalk.cyan(`═══ Step ${num} of ${total}: ${title} ═══`));
  console.log('');
}

export function divider() {
  console.log(chalk.dim('  ──────────────────────────────────────'));
}

export function ok(msg) { console.log(chalk.green(`  ✓ ${msg}`)); }
export function fail(msg) { console.log(chalk.red(`  ✗ ${msg}`)); }
export function warn(msg) { console.log(chalk.yellow(`  ⚠ ${msg}`)); }
export function info(msg) { console.log(chalk.dim(`  · ${msg}`)); }
export function line(msg = '') { console.log(msg ? `  ${msg}` : ''); }

export function summary(label, value) {
  console.log(`  ${chalk.dim(label.padEnd(22))}${value}`);
}

export function completeBanner() {
  console.log('');
  console.log(chalk.green('════════════════════════════════════════════════════'));
  console.log(chalk.green('  Setup Complete!'));
  console.log(chalk.green('════════════════════════════════════════════════════'));
  console.log('');
}
