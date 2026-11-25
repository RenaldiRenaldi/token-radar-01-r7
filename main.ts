import {readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './lib/book.ts';
import {buildDossier} from './vendor/makefun-board.ts';

function flag(name: string, fallback: string) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] ?? fallback : fallback;
}

const root = fileURLToPath(new URL('.', import.meta.url));
const revision = 'R7 final evidence';
const input = flag('input', '/input');
const output = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const data = build(JSON.parse(readFileSync(input.endsWith('.json') ? input : join(input, 'snapshot.json'), 'utf8')));
const write = (file: string, content: string | Uint8Array) => writeFileSync(join(output, file), content);
const json = (file: string, value: unknown) => write(file, JSON.stringify(value) + '\n');

mkdirSync(join(output, 'dashboard'), {recursive: true});
for (const name of readdirSync(join(root, 'dashboard')).sort()) {
  copyFileSync(join(root, 'dashboard', name), join(output, 'dashboard', name));
}
json('board.json', {rows: data.rows});
json('universe.json', data.ledger);
json('validation.json', data.validation);
write('data.js', 'window.SOUNDINGS = ' + JSON.stringify(data) + ';\n');
write('dashboard/evidence.txt', [
  'Sealed DefiLlama snapshot dated ' + data.asOf,
  'Universe ' + data.ledger.length + ', launches ' + data.rows.length + ', watchlist ' + data.rows.filter(r => r.watch).length,
  'Model: ' + data.validation.model,
  'Same-population leave-one-out: ' + JSON.stringify(data.validation.loo),
  'Listing-cohort transfer using same-day features, 30-day gaps and token group exclusion.',
  ...data.validation.replay.windows.map(w => JSON.stringify({year:w.year, train:w.train.length, valid:w.valid.length, test:w.predictions.length, n:w.n, median:w.median, hits:w.hits})),
  'Launch rank | Protocol | Circulating cap scenario | Residual range | Bootstrap rank span | $1k 30-day scenario net',
  ...data.rows.map(r => [r.rank, r.slug, r.implied_value_usd, r.band.join('–'), r.stability?.rankMin + '–' + r.stability?.rankMax, r.farm.base.net.toFixed(2)].join(' | ')),
].join('\n') + '\n');

const captures = join(root, 'captures');
if (existsSync(captures) && !process.argv.includes('--preview')) {
  mkdirSync(join(output, 'screenshots'), {recursive: true});
  const names = readdirSync(captures).filter(name => name.endsWith('.jpg.b64')).sort();
  if (names.length < 3 || names.length > 4) throw new Error('Expected three or four dashboard captures');
  for (const name of names) {
    write('screenshots/' + name.slice(0, -4), Buffer.from(readFileSync(join(captures, name), 'utf8'), 'base64'));
  }
  write('dossier.json', buildDossier(output, {text_max_bytes: 65_536, screenshots: {max: 4, max_bytes: 524_288}}));
} else if (!process.argv.includes('--preview')) {
  throw new Error('Missing dashboard captures');
}

console.log(JSON.stringify({
  protocols: data.ledger.length, launch: data.rows.length,
  watchlistCovered: data.rows.filter(row => row.watch).length,
  model: data.validation.model,
  loo: data.validation.loo, dated: data.validation.replay.windows.map(w => ({year: w.year, n: w.n, median: w.median, hits: w.hits})),
  refits: data.validation.refits, leaders: data.rows.slice(0, 5).map(r => ({slug: r.slug, range: r.stability?.rank80})),
}));
