// Launch Radar: the entry program for the token launch radar (Node 22, standard library only).
//
// One run does five things, in order:
//   1. reads the sealed protocol snapshot (default /input/snapshot.json; --input <file|dir>),
//   2. scores every qualifying pre-token protocol with the model in lib/model.ts and checks the
//      board against the gate's shape before anything is written,
//   3. writes the ranked board to <output>/board.json and the dashboard's dataset to
//      <output>/data.js, from the same board, so the page and the board cannot disagree,
//   4. copies this repository's dashboard/ and screenshots/ into <output>,
//   5. writes <output>/dossier.json last, with buildDossier from vendor/makefun-board.ts (the
//      scorer's own library, byte for byte), because the scorer rebuilds it and compares bytes.
//
// The output directory is --output <dir>, else $MAKEFUN_OUTPUT_DIR, else /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
//
// The program is deterministic: it reads no clock and no randomness, so two runs over the same
// snapshot write the same bytes.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** The gate's caps, as the scorer states them: the dossier's text cap shapes bytes, the rest refuse. */
const DOSSIER_TEXT_MAX = 65_536;
const DOSSIER_SCREENSHOTS = { max: 4, max_bytes: 524_288 };
const DOSSIER_DASHBOARD = { max_files: 400, max_bytes: 4_194_304 };
const PLAIN_IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function fail(message: string): never {
  process.stderr.write(`launch radar: ${message}\n`);
  process.exit(1);
}

/** A `--name value` or `--name=value` argument, or the fallback when neither is present. */
function argument(name: string, fallback: string): string {
  const argv = process.argv.slice(2);
  const at = argv.indexOf(`--${name}`);
  if (at !== -1) {
    const value = argv[at + 1];
    if (value === undefined) fail(`--${name} needs a value`);
    return value;
  }
  const inline = argv.find((a) => a.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

/** The snapshot file an --input argument names: the file itself, or snapshot.json inside a directory. */
function snapshotPath(input: string): string {
  return input.endsWith('.json') ? input : join(input, 'snapshot.json');
}

/**
 * Copy a directory tree of regular files into `to`, skipping any name that starts with a dot,
 * and return the relative paths copied. The dashboard and the screenshots are flat by design;
 * the recursion only keeps a stray subfolder from being silently dropped.
 */
function copyTree(from: string, to: string, prefix = ''): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(source).isDirectory()) copied.push(...copyTree(source, join(to, name), rel));
    else if (statSync(source).isFile()) {
      copyFileSync(source, join(to, name));
      copied.push(rel);
    }
  }
  return copied;
}

const inputFile = snapshotPath(argument('input', '/input'));
if (!existsSync(inputFile)) {
  fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed input`);
}
const outDir = argument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snapshot;
let board;
let radar;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
  ({ board, radar } = buildRadar(snapshot));
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

const dashboardFiles = copyTree(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
if (dashboardFiles.length === 0) fail('dashboard/ is empty: the page is half of the entry');

const shots = copyTree(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3 || shots.length > 4) {
  fail(`screenshots/ holds ${shots.length} files: hand in 3 or 4, the board, a detail view and a filtered view among them`);
}
for (const name of shots) {
  if (!PLAIN_IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier goes last: it is built from the dashboard and screenshots as they now stand.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: DOSSIER_TEXT_MAX, screenshots: DOSSIER_SCREENSHOTS, dashboard: DOSSIER_DASHBOARD }),
);

process.stdout.write(
  `launch radar: scanned ${snapshot.protocols.length} protocols as of ${snapshot.as_of}; ` +
    `${board.length} pre-token rows ranked (${radar.watchlist_size}/${snapshot.watchlist.length} watchlist, ${radar.early_size} early), ` +
    `${radar.live_size} live-token protocols set aside\n` +
    `launch radar: wrote board.json, data.js, dashboard/ (${dashboardFiles.length} files), screenshots/ (${shots.length} images) and dossier.json to ${outDir}\n`,
);
