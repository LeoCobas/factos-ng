import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_SUPABASE_URL = 'https://veqpyhqnpuemdysdorse.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_bDBNWFoVt4Hj8DuGSb59IA_mluAzyez';

const outputPath = resolve('public/app-config.json');

function readConfigFromEnv() {
  return {
    supabase: {
      url: process.env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY,
    },
  };
}

async function main() {
  const config = readConfigFromEnv();

  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error('Runtime config incompleta: falta SUPABASE_URL o SUPABASE_ANON_KEY.');
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(`${outputPath}`, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const source = process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY ? 'env' : 'defaults';
  console.log(`[runtime-config] Generated public/app-config.json using ${source}.`);
}

main().catch((error) => {
  console.error('[runtime-config] Failed to generate app-config.json');
  console.error(error);
  process.exitCode = 1;
});
