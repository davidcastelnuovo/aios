import { readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function deployFunctions({ environment, names, project, productionProject, root = process.cwd(), run = spawnSync }) {
  if (!['staging', 'production'].includes(environment)) throw new Error('Explicit deployment environment required');
  if (!/^[a-z]{20}$/.test(project || '') || (environment === 'staging' && (!productionProject || project === productionProject))) {
    throw new Error('Invalid target project');
  }
  if (!names.length) return;
  const help = run('supabase', ['functions', 'deploy', '--help'], { encoding: 'utf8', cwd: root });
  if (help.status !== 0 || !help.stdout.includes('--use-api')) throw new Error('CLI must support server-side bundling');
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
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
      console.log(`Deploying ${environment}: ${name}`);
      const result = run('supabase', args, { stdio: 'inherit', cwd: root });
      if (result.status !== 0) throw new Error(`Deployment failed: ${name}`);
    } finally {
      // A failed rename must never delete the original entrypoint. Restore even
      // when writing the wrapper or the CLI itself failed.
      if (wrapped) { rmSync(entry, { force: true }); renameSync(saved, entry); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [environment, ...names] = process.argv.slice(2);
  deployFunctions({ environment, names, project: process.env.PROJECT_REF, productionProject: process.env.PRODUCTION_REF });
}
