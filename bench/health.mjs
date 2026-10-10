import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { Agent, request } from 'node:http';
import { createRequire } from 'node:module';
import { cpus, loadavg } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(new URL('.', import.meta.url)));
const fixture = join(repoRoot, 'e2e/fixtures/health.ts');
const outDir = join(repoRoot, 'bench/.out');
const resultsDir = join(repoRoot, 'bench/results');
const require = createRequire(import.meta.url);
const tsxBin = require.resolve('tsx/cli');
const scriptcBin = join(repoRoot, 'node_modules/.bin/scriptc');

const ROUNDS = positiveInt(process.env.BENCH_ROUNDS, 3);
const WARMUP = 50;
const SAMPLES = 500;
const LOAD_REQUESTS = 5000;
const LOAD_CONCURRENCY = 32;
const EXPECTED = '{"ok":true}';
// Per-round measurements; each saved cell is the median across rounds.
const METRICS = [
  'startup_ms',
  'first_get_ms',
  'p50_ms',
  'p95_ms',
  'rps',
  'load_rps',
  'load_p99_ms',
  'rss_kb',
  'peak_rss_kb',
];

// Class bounds for the product binary (PERF-02/03). Crossing one is a FLAG, not a CI failure.
const NATIVE_RSS_CLASS_KB = 16_000;
const NATIVE_ARTIFACT_CLASS_BYTES = 5_000_000;
// A scriptc row this much worse than the previous saved row is a FLAG.
const REGRESSION_RATIO = 1.15;

const present = {
  bun: await which('bun'),
  deno: await which('deno'),
};

await mkdir(outDir, { recursive: true });
await mkdir(resultsDir, { recursive: true });

const scriptcVersion = await versionLine(scriptcBin, ['--version']);
const variants = ['dev', 'release', 'speed'];
const targets = [];
for (const optimization of variants) {
  const binary = join(outDir, `health-${optimization}`);
  const build = await run(scriptcBin, [
    'build',
    fixture,
    '-o',
    binary,
    '--optimization',
    optimization,
  ]);
  if (build.status !== 0) {
    throw new Error(
      `scriptc build (${optimization}) failed:\n${build.stderr}\n${build.stdout}`,
    );
  }
  targets.push({
    id: `scriptc-${optimization}`,
    label: `scriptc native (${optimization})`,
    argv: [binary, '0'],
    artifact: binary,
    artifactKind: 'native-app',
  });
}
targets.push({
  id: 'node',
  label: 'Node (tsx)',
  argv: [process.execPath, tsxBin, fixture, '0'],
  artifact: process.execPath,
  artifactKind: 'host-runtime',
});

const bunCompileOut = join(outDir, 'health-bun');
const denoCompileOut = join(outDir, 'health-deno');
const bunCompile = present.bun
  ? await tryCompileSize('bun', bunCompileOut)
  : null;
const denoCompile = present.deno
  ? await tryCompileSize('deno', denoCompileOut)
  : null;
if (present.bun) {
  targets.push({
    id: 'bun',
    label: 'Bun (process)',
    argv: ['bun', fixture, '0'],
    artifact: bunCompileOut,
    artifactKind: 'embedded-engine-compile',
  });
}
if (present.deno) {
  targets.push({
    id: 'deno',
    label: 'Deno (process)',
    argv: [
      'deno',
      'run',
      '--allow-net',
      '--allow-env',
      '--allow-read',
      '--sloppy-imports',
      fixture,
      '0',
    ],
    artifact: denoCompileOut,
    artifactKind: 'embedded-engine-compile',
  });
}

const loadBefore = loadavg();
// Rounds interleave targets so background load hits every target alike.
const perTarget = new Map(targets.map((t) => [t.id, []]));
const errors = new Map();
for (let round = 0; round < ROUNDS; round += 1) {
  for (const target of targets) {
    if (errors.has(target.id)) {
      continue;
    }
    try {
      perTarget.get(target.id).push(await measure(target));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.set(target.id, message.split('\n')[0] ?? message);
    }
  }
}
const loadAfter = loadavg();

const rows = [];
for (const target of targets) {
  const runs = perTarget.get(target.id);
  if (errors.has(target.id) || runs.length === 0) {
    rows.push({
      id: target.id,
      label: target.label,
      skipped: true,
      error: errors.get(target.id) ?? 'no runs',
    });
    continue;
  }
  rows.push({
    id: target.id,
    label: target.label,
    skipped: false,
    ...Object.fromEntries(
      METRICS.map((key) => [key, median(runs.map((r) => r[key]))]),
    ),
    artifact_bytes: await sizeOf(target.artifact),
    artifact_kind: target.artifactKind,
  });
}

const record = {
  id: 'health',
  fixture: 'e2e/fixtures/health.ts',
  recorded_at: new Date().toISOString(),
  host: {
    os: process.platform,
    arch: process.arch,
    cpus: cpus().length,
    loadavg_1m_before: Number(loadBefore[0].toFixed(2)),
    loadavg_1m_after: Number(loadAfter[0].toFixed(2)),
    node: process.version,
    scriptc: scriptcVersion,
    bun: present.bun ? await versionLine('bun', ['-v']) : null,
    deno: present.deno ? await versionLine('deno', ['--version']) : null,
  },
  method: {
    rounds: ROUNDS,
    warmup: WARMUP,
    samples: SAMPLES,
    load_requests: LOAD_REQUESTS,
    load_concurrency: LOAD_CONCURRENCY,
    notes:
      'Each cell is the median of the rounds; rounds interleave targets. Startup is spawn until NODUM_PORT. First GET is the first request on a fresh connection. p50/p95/req/s: sequential keep-alive GET /health after warmup. Load: concurrent keep-alive GETs; load p99 is per-request latency under that load. RSS is VmRSS after the sequential samples; peak RSS is VmHWM after load. Artifact: scriptc is the native app per optimization mode; Node is the host node binary; Bun/Deno are --compile / compile outputs (embedded engine).',
  },
  rows,
  compile_contrast: {
    bun_compile_bytes: bunCompile,
    deno_compile_bytes: denoCompile,
  },
};

const previous = await latestRecord();
const flags = findFlags(record, previous?.record);
record.flags = flags;

const stamp = record.recorded_at.slice(0, 19).replaceAll(':', '');
const outFile = join(resultsDir, `${stamp}-health.json`);
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);

const out = [markdownTable(record)];
if (previous !== null) {
  out.push(
    '',
    `vs ${previous.file}:`,
    '',
    compareTable(record, previous.record),
  );
}
out.push(
  '',
  `Host: ${String(record.host.cpus)} CPUs, load ${String(record.host.loadavg_1m_before)} → ${String(record.host.loadavg_1m_after)}, Node ${record.host.node}, scriptc ${scriptcVersion}`,
);
for (const flag of flags) {
  out.push(`**FLAG:** ${flag}`);
}
if (record.host.loadavg_1m_before > record.host.cpus * 0.5) {
  out.push(
    `Note: the host was busy (load ${String(record.host.loadavg_1m_before)} on ${String(record.host.cpus)} CPUs). Compare ratios between rows, not absolute ms.`,
  );
}
out.push('', `Wrote ${outFile}`);
process.stdout.write(`${out.join('\n')}\n`);

async function measure(target) {
  const started = performance.now();
  const child = spawn(target.argv[0], target.argv.slice(1), {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  try {
    const port = await waitForPort(
      child,
      () => stdout,
      () => stderr,
    );
    const startupMs = performance.now() - started;
    const agent = new Agent({ keepAlive: true, maxSockets: LOAD_CONCURRENCY });
    try {
      const first = performance.now();
      await getHealth(agent, port, target.id);
      const firstGetMs = performance.now() - first;
      for (let i = 0; i < WARMUP; i += 1) {
        await getHealth(agent, port, target.id);
      }
      const samples = [];
      const windowStart = performance.now();
      for (let i = 0; i < SAMPLES; i += 1) {
        const t0 = performance.now();
        await getHealth(agent, port, target.id);
        samples.push(performance.now() - t0);
      }
      const elapsedMs = performance.now() - windowStart;
      const rssKb = readStatusKb(child.pid, 'VmRSS');
      const load = await loadPhase(agent, port, target.id);
      const peakRssKb = readStatusKb(child.pid, 'VmHWM');
      samples.sort((a, b) => a - b);
      return {
        startup_ms: startupMs,
        first_get_ms: firstGetMs,
        p50_ms: percentile(samples, 0.5),
        p95_ms: percentile(samples, 0.95),
        rps: SAMPLES / (elapsedMs / 1000),
        load_rps: load.rps,
        load_p99_ms: load.p99,
        rss_kb: rssKb,
        peak_rss_kb: peakRssKb,
      };
    } finally {
      agent.destroy();
    }
  } finally {
    child.kill('SIGTERM');
    await waitClose(child);
  }
}

async function loadPhase(agent, port, id) {
  let next = 0;
  const latencies = [];
  const started = performance.now();
  async function worker() {
    while (next < LOAD_REQUESTS) {
      next += 1;
      const t0 = performance.now();
      await getHealth(agent, port, id);
      latencies.push(performance.now() - t0);
    }
  }
  // Workers share `next` and `latencies`; JS runs them one callback at a time.
  await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
  const elapsedMs = performance.now() - started;
  latencies.sort((a, b) => a - b);
  return {
    rps: latencies.length / (elapsedMs / 1000),
    p99: percentile(latencies, 0.99),
  };
}

function getHealth(agent, port, id) {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/health', agent },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200 || body !== EXPECTED) {
            reject(
              new Error(`${id} GET /health: ${String(res.statusCode)} ${body}`),
            );
            return;
          }
          resolve();
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function findFlags(current, prev) {
  const flags = [];
  for (const row of current.rows) {
    if (row.skipped || row.artifact_kind !== 'native-app') {
      continue;
    }
    if (row.peak_rss_kb !== null && row.peak_rss_kb > NATIVE_RSS_CLASS_KB) {
      flags.push(
        `${row.label} peak RSS ${String(row.peak_rss_kb)} KB left the low-MB class (> ${String(NATIVE_RSS_CLASS_KB)} KB).`,
      );
    }
    if (
      row.artifact_bytes !== null &&
      row.artifact_bytes > NATIVE_ARTIFACT_CLASS_BYTES
    ) {
      flags.push(
        `${row.label} binary ${fmtBytes(row.artifact_bytes)} left the hundreds-of-KB class.`,
      );
    }
    const before = prev === undefined ? undefined : previousRow(prev, row.id);
    if (before === undefined || before.skipped) {
      continue;
    }
    for (const key of ['rss_kb', 'artifact_bytes']) {
      if (
        before[key] !== null &&
        row[key] !== null &&
        row[key] > before[key] * REGRESSION_RATIO
      ) {
        flags.push(
          `${row.label} ${key} regressed: ${String(before[key])} → ${String(row[key])}.`,
        );
      }
    }
  }
  return flags;
}

// Rows before the multi-mode bench had a single `scriptc` row built with --optimization dev.
function previousRow(prev, id) {
  return (
    prev.rows.find((r) => r.id === id) ??
    (id === 'scriptc-dev'
      ? prev.rows.find((r) => r.id === 'scriptc')
      : undefined)
  );
}

async function latestRecord() {
  let files;
  try {
    files = (await readdir(resultsDir)).filter((f) =>
      f.endsWith('-health.json'),
    );
  } catch {
    return null;
  }
  files.sort();
  const file = files.at(-1);
  if (file === undefined) {
    return null;
  }
  return {
    file,
    record: JSON.parse(await readFile(join(resultsDir, file), 'utf8')),
  };
}

function median(values) {
  const nums = values
    .filter((v) => typeof v === 'number')
    .sort((a, b) => a - b);
  if (nums.length === 0) {
    return null;
  }
  const mid = Math.floor(nums.length / 2);
  const value =
    nums.length % 2 === 1
      ? nums[mid]
      : ((nums[mid - 1] ?? 0) + (nums[mid] ?? 0)) / 2;
  return Number(value.toFixed(2));
}

function percentile(sorted, q) {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.floor(q * (sorted.length - 1)),
  );
  return sorted[index] ?? null;
}

function readStatusKb(pid, field) {
  if (pid === undefined || process.platform !== 'linux') {
    return null;
  }
  try {
    const text = readFileSync(`/proc/${String(pid)}/status`, 'utf8');
    const match = new RegExp(`^${field}:\\s+(\\d+)\\s+kB$`, 'm').exec(text);
    return match?.[1] !== undefined ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function waitForPort(child, getStdout, getStderr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`no NODUM_PORT. stdout=${getStdout()} stderr=${getStderr()}`),
      );
    }, 20_000);
    const onClose = (status) => {
      clearTimeout(timer);
      reject(
        new Error(
          `exited ${String(status)} before listen. stdout=${getStdout()} stderr=${getStderr()}`,
        ),
      );
    };
    child.once('close', onClose);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    const tick = () => {
      const match = /NODUM_PORT=(\d+)/.exec(getStdout());
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        child.removeListener('close', onClose);
        resolve(Number(match[1]));
      }
    };
    tick();
    child.stdout.on('data', tick);
  });
}

function waitClose(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 2000);
    child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

async function run(bin, args) {
  return await new Promise((resolve) => {
    const child = spawn(bin, args, { cwd: repoRoot, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', () => {
      resolve({ status: 1, stdout, stderr });
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

async function which(bin) {
  const result = await run('sh', ['-c', `command -v ${bin}`]);
  return result.status === 0;
}

async function versionLine(bin, args) {
  const result = await run(bin, args);
  const text = `${result.stdout}\n${result.stderr}`.trim();
  return text.split('\n')[0] ?? text;
}

async function tryCompileSize(kind, dest) {
  const args =
    kind === 'bun'
      ? ['build', '--compile', fixture, `--outfile=${dest}`]
      : [
          'compile',
          '--no-check',
          '--allow-net',
          '--allow-env',
          '--allow-read',
          '--sloppy-imports',
          '-o',
          dest,
          fixture,
        ];
  const result = await run(kind, args);
  return result.status === 0 ? await sizeOf(dest) : null;
}

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function markdownTable(rec) {
  const lines = [
    `| Target | Startup | First GET | p50 | p95 | req/s | Load req/s (c=${String(LOAD_CONCURRENCY)}) | Load p99 | RSS | Peak RSS | Artifact |`,
    `| ------ | ------- | --------- | --- | --- | ----- | ---------- | -------- | --- | -------- | -------- |`,
  ];
  for (const row of rec.rows) {
    if (row.skipped) {
      lines.push(
        `| ${row.label} | skipped | | | | | | | | | ${row.error ?? ''} |`,
      );
      continue;
    }
    lines.push(
      `| ${row.label} | ${fmtMs(row.startup_ms)} | ${fmtMs(row.first_get_ms)} | ${fmtMs(row.p50_ms)} | ${fmtMs(row.p95_ms)} | ${fmtNum(row.rps)} | ${fmtNum(row.load_rps)} | ${fmtMs(row.load_p99_ms)} | ${fmtKb(row.rss_kb)} | ${fmtKb(row.peak_rss_kb)} | ${fmtArtifact(row)} |`,
    );
  }
  const extra = [];
  if (rec.compile_contrast.bun_compile_bytes !== null) {
    extra.push(
      `Bun --compile size: ${fmtBytes(rec.compile_contrast.bun_compile_bytes)}`,
    );
  }
  if (rec.compile_contrast.deno_compile_bytes !== null) {
    extra.push(
      `Deno compile size: ${fmtBytes(rec.compile_contrast.deno_compile_bytes)}`,
    );
  }
  if (extra.length > 0) {
    lines.push('', extra.join(' · '));
  }
  return lines.join('\n');
}

function compareTable(current, prev) {
  const lines = [
    '| Target | Startup | First GET | p50 | req/s | RSS | Artifact |',
    '| ------ | ------- | --------- | --- | ----- | --- | -------- |',
  ];
  for (const row of current.rows) {
    const before = previousRow(prev, row.id);
    if (row.skipped || before === undefined || before.skipped) {
      continue;
    }
    lines.push(
      `| ${row.label} | ${delta(before.startup_ms, row.startup_ms)} | ${delta(before.first_get_ms, row.first_get_ms)} | ${delta(before.p50_ms, row.p50_ms)} | ${delta(before.rps, row.rps)} | ${delta(before.rss_kb, row.rss_kb)} | ${delta(before.artifact_bytes, row.artifact_bytes)} |`,
    );
  }
  return lines.join('\n');
}

function delta(before, after) {
  if (typeof before !== 'number' || typeof after !== 'number' || before === 0) {
    return '—';
  }
  const pct = ((after - before) / before) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${String(before)} → ${String(after)} (${sign}${pct.toFixed(0)}%)`;
}

function fmtMs(value) {
  return value === null || value === undefined ? '—' : `${String(value)} ms`;
}

function fmtNum(value) {
  return value === null || value === undefined
    ? '—'
    : String(Math.round(value));
}

function fmtKb(kb) {
  return kb === null || kb === undefined ? '—' : `${String(kb)} KB`;
}

function fmtArtifact(row) {
  const size = fmtBytes(row.artifact_bytes);
  if (size === '—') {
    return '—';
  }
  if (row.artifact_kind === 'host-runtime') {
    return `${size} (node host)`;
  }
  if (row.artifact_kind === 'embedded-engine-compile') {
    return `${size} (compile)`;
  }
  return size;
}

function fmtBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return '—';
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1000) {
    return `${(bytes / 1000).toFixed(1)} KB`;
  }
  return `${String(bytes)} B`;
}
