import { readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function deployFunctions({ environment, names, project, productionProject, root = process.cwd(), run = spawnSync, attempts = 3, pause = wait }) {
  if (!['staging', 'production'].includes(environment)) throw new Error('Explicit deployment environment required');
  if (!/^[a-z]{20}$/.test(project || '') || (environment === 'staging' && (!productionProject || project === productionProject))) {
    throw new Error('Invalid target project');
  }
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Invalid retry count');
  if (!names.length) return;
  const help = run('supabase', ['functions', 'deploy', '--help'], { encoding: 'utf8', cwd: root });
  if (help.status !== 0 || !help.stdout.includes('--use-api')) throw new Error('CLI must support server-side bundling');
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  const failed = [];
  for (const name of names) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('Invalid function name');
    const entry = resolve(root, `supabase/functions/${name}/index.ts`);
    const saved = resolve(root, `supabase/functions/${name}/_aios-source.ts`);
    const section = config.match(new RegExp(`\\[functions\\.${name}\\]([^]*?)(?=\\n\\[|$)`))?.[1] || '';
    const args = ['functions', 'deploy', name, '--project-ref', project, '--use-api'];
    if (/verify_jwt\s*=\s*false/.test(section)) args.push('--no-verify-jwt');
    let wrapped = false;
    try {
      if (environment === 'staging') {
        if (existsSync(saved)) throw new Error(`Saved source already exists: ${name}`);
        renameSync(entry, saved);
        wrapped = true;
        writeFileSync(entry, `import { installStagingOutboundGuard } from '../_shared/staging-outbound.mjs';\ninstallStagingOutboundGuard(Deno.env.get('SUPABASE_URL')!);\nawait import('./_aios-source.ts');\n`);
      }
      let deployed = false;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        console.log(`Deploying ${environment}: ${name}${attempt > 1 ? ` (retry ${attempt})` : ''}`);
        const result = run('supabase', args, { stdio: 'inherit', cwd: root });
        if (result.status === 0) { deployed = true; break; }
        // A platform 500 must not cancel functions later in the alphabet.
        if (attempt < attempts) pause(attempt * 20000);
      }
      if (!deployed) {
        console.error(`Deployment failed: ${name}`);
        failed.push(name);
      }
    } finally {
      // A failed rename must never delete the original entrypoint. Restore even
      // when writing the wrapper or the CLI itself failed.
      if (wrapped) { rmSync(entry, { force: true }); renameSync(saved, entry); }
    }
  }
  if (failed.length) throw new Error(`Deployment failed: ${failed.join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [environment, ...names] = process.argv.slice(2);
  deployFunctions({ environment, names, project: process.env.PROJECT_REF, productionProject: process.env.PRODUCTION_REF });
}
