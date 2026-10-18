// Test baseline guard.
//
// Fails (exit 1) if the real total test count drops below baseline.minTests
// or the number of `it.fails` markers in test/*.test.js grows beyond
// baseline.maxItFails. baseline.json changes only on the owner's explicit
// request.
//
// Usage: node test/check-baseline.mjs [path-to-baseline.json]

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(testDir);

const baselinePath = resolve(process.argv[2] ?? join(testDir, 'baseline.json'));
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

// Real total test count. `vitest list --json` exists in vitest 5 but
// under-counts parameterized it.each/test.each cases, so run the suite with
// the JSON reporter and read numTotalTests from the report.
const vitestBin = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const outFile = join(tmpdir(), `vitest-baseline-${process.pid}.json`);
try {
  execFileSync(
    process.execPath,
    [vitestBin, 'run', '--reporter=json', `--outputFile=${outFile}`],
    { cwd: root, stdio: 'ignore' },
  );
} catch {
  // vitest exits non-zero when tests fail; the JSON report is still written.
}
const report = JSON.parse(readFileSync(outFile, 'utf8'));
rmSync(outFile, { force: true });
const totalTests = report.numTotalTests;

let itFails = 0;
for (const file of readdirSync(testDir)) {
  if (!file.endsWith('.test.js')) continue;
  const src = readFileSync(join(testDir, file), 'utf8');
  itFails += (src.match(/\bit\.fails\b/g) ?? []).length;
}

const fail = (msg) => {
  console.error(`baseline check failed: ${msg}`);
  console.error('baseline.json changes only on the owner\'s explicit request.');
  process.exit(1);
};

if (typeof totalTests !== 'number') {
  fail(`could not read numTotalTests from vitest JSON report (${outFile})`);
}
if (totalTests < baseline.minTests) {
  fail(`test count ${totalTests} < minTests ${baseline.minTests}`);
}
if (itFails > baseline.maxItFails) {
  fail(`it.fails count ${itFails} > maxItFails ${baseline.maxItFails}`);
}

console.log(
  `baseline ok: ${totalTests} tests (min ${baseline.minTests}), ` +
    `${itFails} it.fails (max ${baseline.maxItFails})`,
);
