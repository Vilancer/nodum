import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(new URL('.', import.meta.url)));
const fixture = join(repoRoot, 'e2e/fixtures/health.ts');
const outDir = join(repoRoot, 'bench/.out');
const resultsDir = join(repoRoot, 'bench/results');
const require = createRequire(import.meta.url);
const tsxBin = require.resolve('tsx/cli');
const scriptcBin = join(repoRoot, 'node_modules/.bin/scriptc');

const WARMUP = 20;
const SAMPLES = 200;

const present = {
  bun: Boolean(await which('bun')),
  deno: Boolean(await which('deno')),
};

await mkdir(outDir, { recursive: true });
await mkdir(resultsDir, { recursive: true });

const scriptcBinary = join(outDir, 'health');
const scriptcBuild = await run(scriptcBin, [
  'build',
  fixture,
  '-o',
  scriptcBinary,
  '--optimization',
  'dev',
  '--backend',
  'llvm',
]);
if (scriptcBuild.status !== 0) {
  throw new Error(
    `scriptc build failed:\n${scriptcBuild.stderr}\n${scriptcBuild.stdout}`,
  );
}

const targets = [
  {
    id: 'scriptc',
    label: 'scriptc native',
    argv: [scriptcBinary, '0'],
    artifact: scriptcBinary,
  },
  {
    id: 'node',
    label: 'Node (tsx)',
    argv: [process.execPath, tsxBin, fixture, '0'],
    artifact: null,
  },
];

if (present.bun) {
  targets.push({
    id: 'bun',
    label: 'Bun (process)',
    argv: ['bun', fixture, '0'],
    artifact: null,
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
    artifact: null,
  });
}

const rows = [];
for (const target of targets) {
  try {
    rows.push(await measure(target));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rows.push({
      id: target.id,
      label: target.label,
      skipped: true,
      error: message.split('\n')[0] ?? message,
    });
  }
}

const bunCompile = present.bun ? await tryCompileSize('bun') : null;
const denoCompile = present.deno ? await tryCompileSize('deno') : null;

const record = {
  id: 'health',
  fixture: 'e2e/fixtures/health.ts',
  recorded_at: new Date().toISOString(),
  host: {
    os: process.platform,
    arch: process.arch,
    node: process.version,
    bun: present.bun ? await versionLine('bun', ['-v']) : null,
    deno: present.deno ? await versionLine('deno', ['--version']) : null,
  },
  method: {
    warmup: WARMUP,
    samples: SAMPLES,
    notes:
      'Startup is spawn until NODUM_PORT. Latency is sequential GET /health after warmup. RSS is VmRSS after samples. scriptc artifact is --optimization dev.',
  },
  rows,
  compile_contrast: {
    bun_compile_bytes: bunCompile,
    deno_compile_bytes: denoCompile,
  },
};

const stamp = record.recorded_at.slice(0, 19).replaceAll(':', '');
const outFile = join(resultsDir, `${stamp}-health.json`);
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${markdownTable(record)}\n\nWrote ${outFile}\n`);

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
  const port = await waitForPort(
    child,
    () => stdout,
    () => stderr,
  );
  const startupMs = roundMs(performance.now() - started);
  const url = `http://127.0.0.1:${String(port)}/health`;
  const first = performance.now();
  const firstBody = await getHealth(url);
  const firstGetMs = roundMs(performance.now() - first);
  if (firstBody !== '{"ok":true}') {
    child.kill('SIGTERM');
    throw new Error(`${target.id} first GET got ${firstBody}`);
  }
  for (let i = 0; i < WARMUP; i += 1) {
    await getHealth(url);
  }
  const samples = [];
  const windowStart = performance.now();
  for (let i = 0; i < SAMPLES; i += 1) {
    const t0 = performance.now();
    const body = await getHealth(url);
    samples.push(performance.now() - t0);
    if (body !== '{"ok":true}') {
      child.kill('SIGTERM');
      throw new Error(`${target.id} sample GET got ${body}`);
    }
  }
  const elapsedMs = performance.now() - windowStart;
  const rssKb = readRssKb(child.pid);
  child.kill('SIGTERM');
  await waitClose(child);
  const sorted = [...samples].sort((a, b) => a - b);
  const artifactBytes = target.artifact
    ? (await stat(target.artifact)).size
    : null;
  return {
    id: target.id,
    label: target.label,
    skipped: false,
    startup_ms: startupMs,
    first_get_ms: firstGetMs,
    p50_ms: roundMs(percentile(sorted, 0.5)),
    p95_ms: roundMs(percentile(sorted, 0.95)),
    rps: Number((SAMPLES / (elapsedMs / 1000)).toFixed(1)),
    rss_kb: rssKb,
    artifact_bytes: artifactBytes,
  };
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

function roundMs(value) {
  return value === null ? null : Number(value.toFixed(2));
}

function readRssKb(pid) {
  if (pid === undefined || process.platform !== 'linux') {
    return null;
  }
  try {
    const { readFileSync } = require('node:fs');
    const text = readFileSync(`/proc/${String(pid)}/status`, 'utf8');
    const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(text);
    return match?.[1] !== undefined ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function waitForPort(child, getStdout, getStderr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
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
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('close', () => {
      resolve();
    });
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 2000);
  });
}

async function getHealth(url) {
  const res = await fetch(url);
  return await res.text();
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

async function tryCompileSize(kind) {
  const dest = join(tmpdir(), `nodum-health-${kind}`);
  try {
    if (kind === 'bun') {
      const result = await run('bun', [
        'build',
        '--compile',
        fixture,
        `--outfile=${dest}`,
      ]);
      if (result.status !== 0) {
        return null;
      }
      return (await stat(dest)).size;
    }
    const result = await run('deno', [
      'compile',
      '--allow-net',
      '--allow-env',
      '--allow-read',
      '--sloppy-imports',
      '-o',
      dest,
      fixture,
    ]);
    if (result.status !== 0) {
      return null;
    }
    return (await stat(dest)).size;
  } catch {
    return null;
  }
}

function markdownTable(record) {
  const lines = [
    `| Target | Startup | First GET | p50 | p95 | req/s | RSS | Artifact |`,
    `| ------ | ------- | --------- | --- | --- | ----- | --- | -------- |`,
  ];
  for (const row of record.rows) {
    if (row.skipped) {
      lines.push(`| ${row.label} | skipped | | | | | | ${row.error ?? ''} |`);
      continue;
    }
    lines.push(
      `| ${row.label} | ${fmtMs(row.startup_ms)} | ${fmtMs(row.first_get_ms)} | ${fmtMs(row.p50_ms)} | ${fmtMs(row.p95_ms)} | ${String(row.rps)} | ${fmtRss(row.rss_kb)} | ${fmtBytes(row.artifact_bytes)} |`,
    );
  }
  const extra = [];
  if (record.compile_contrast.bun_compile_bytes !== null) {
    extra.push(
      `Bun --compile size: ${fmtBytes(record.compile_contrast.bun_compile_bytes)}`,
    );
  }
  if (record.compile_contrast.deno_compile_bytes !== null) {
    extra.push(
      `Deno compile size: ${fmtBytes(record.compile_contrast.deno_compile_bytes)}`,
    );
  }
  if (extra.length > 0) {
    lines.push('', extra.join(' · '));
  }
  return lines.join('\n');
}

function fmtMs(value) {
  return value === null || value === undefined ? '—' : `${String(value)} ms`;
}

function fmtRss(kb) {
  return kb === null || kb === undefined ? '—' : `${String(kb)} KB`;
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
