import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function deploymentPlan(files, available, requested = '') {
  const names = new Set(available);
  if (requested.trim()) {
    const selected = [...new Set(requested.trim().split(/\s+/))];
    for (const name of selected) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || !names.has(name)) throw new Error(`Unknown function: ${name}`);
    }
    return selected.sort();
  }
  // Shared modules and config are part of deployed bundles. Redeploy every
  // consumer conservatively; never silently leave old shared code running.
  if (files.some(file => file.startsWith('supabase/functions/_shared/') ||
    file === 'supabase/config.toml' || file.startsWith('scripts/deploy-edge') ||
    file === 'scripts/staging-only-functions.json')) return [...names].sort();
  return [...new Set(files.map(file => file.match(/^supabase\/functions\/([^/]+)\//)?.[1])
    .filter(name => names.has(name)))].sort();
}

export function productionChanges(files, beforeConfig, afterConfig, stagingOnly) {
  const normalizeConfig = (config) => {
    for (const name of stagingOnly) {
      config = config.replace(new RegExp(`\\[functions\\.${name}\\][^]*?(?=\\n\\[|$)`, 'g'), '');
    }
    return config.split('\n').map(line => line.replace(/#.*/, '').trim()).filter(Boolean).join('\n');
  };
  return files.filter(file => {
    if (file.startsWith('supabase/functions/_shared/staging-outbound.')) return false;
    if (stagingOnly.some(name => file.startsWith(`supabase/functions/${name}/`))) return false;
    if (file === 'supabase/config.toml') return normalizeConfig(beforeConfig) !== normalizeConfig(afterConfig);
    // Deployer/test/manifest changes have no Production runtime source to deploy.
    return !file.startsWith('scripts/') && !file.startsWith('.github/');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stagingOnly = JSON.parse(readFileSync('scripts/staging-only-functions.json', 'utf8'));
  const available = readdirSync('supabase/functions').filter(name => existsSync(`supabase/functions/${name}/index.ts`) &&
    !(process.env.DEPLOY_ENV === 'production' && stagingOnly.includes(name)));
  if (process.env.DEPLOY_FUNCTIONS?.trim()) {
    process.stdout.write(deploymentPlan([], available, process.env.DEPLOY_FUNCTIONS).join(' '));
    process.exit(0);
  }
  const before = process.env.DEPLOY_BEFORE;
  let files;
  try {
    if (!before || /^0+$/.test(before)) throw new Error('No previous revision');
    files = execFileSync('git', ['diff', '--name-only', before, 'HEAD'], { encoding: 'utf8' }).trim().split('\n');
  } catch {
    if (process.env.DEPLOY_ENV === 'production') throw new Error('Production deployment requires a verified previous revision or explicit function names');
    files = ['supabase/config.toml']; // Missing history must not skip a deploy.
  }
  if (process.env.DEPLOY_ENV === 'production') {
    const beforeConfig = execFileSync('git', ['show', `${before}:supabase/config.toml`], { encoding: 'utf8' });
    files = productionChanges(files, beforeConfig, readFileSync('supabase/config.toml', 'utf8'), stagingOnly);
  }
  process.stdout.write(deploymentPlan(files, available, process.env.DEPLOY_FUNCTIONS).join(' '));
}
