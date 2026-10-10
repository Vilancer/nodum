import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const healthFixture = join(repoRoot, 'e2e/fixtures/health.ts');
const kernelFixture = join(repoRoot, 'e2e/fixtures/kernel.ts');
const helloExample = join(repoRoot, 'examples/hello-http/main.ts');
const scriptcBin = join(repoRoot, 'node_modules/.bin/scriptc');
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

// The spawned binary gets no Node: PATH points nowhere and nothing is inherited.
const NO_NODE_ENV = { PATH: '/nonexistent' };

type Started = { child: ReturnType<typeof spawn>; port: number };

type Case = {
  name: string;
  method: string;
  path: string;
  body?: string;
};

// The same requests run on Node and on the native binary; responses must match.
const CASES: Case[] = [
  { name: 'health', method: 'GET', path: '/health' },
  { name: 'unknown route', method: 'GET', path: '/nope' },
  { name: 'path param', method: 'GET', path: '/items/a%20b' },
  { name: 'query last wins', method: 'GET', path: '/search?q=a&q=b' },
  {
    name: 'JSON body',
    method: 'POST',
    path: '/echo',
    body: '{"name":"Ada","tags":["a",1,true,null]}',
  },
  { name: 'empty JSON body', method: 'POST', path: '/echo', body: '' },
  { name: 'invalid JSON', method: 'POST', path: '/echo', body: '{"name":' },
  {
    name: 'over the body limit',
    method: 'POST',
    path: '/echo',
    body: JSON.stringify({ name: 'x'.repeat(100) }),
  },
  { name: 'AppError', method: 'GET', path: '/teapot' },
  { name: 'unknown throw', method: 'GET', path: '/crash' },
  { name: 'empty 204', method: 'DELETE', path: '/items/1' },
];

describe('[e2e] scriptc', () => {
  let outDir: string;

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'nodum-scriptc-'));
  });

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it.each([
    ['health fixture', healthFixture],
    ['kernel fixture', kernelFixture],
    ['hello-http example', helloExample],
  ])('%s is fully static', async (_name, file) => {
    const result = await runScriptc(['coverage', file], 60_000);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).not.toMatch(/not analyzable/i);
    expect(result.stdout).toMatch(/fully static/i);
    expect(result.stdout).toMatch(/\(100%\)/);
    expect(result.stdout).not.toMatch(/runs with --dynamic/);
  });

  it('builds a native /health binary that answers with no Node on PATH', async () => {
    const binary = await build(healthFixture, join(outDir, 'health'));
    const started = await startServer([binary, '0'], NO_NODE_ENV);
    try {
      const res = await fetch(`http://127.0.0.1:${started.port}/health`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('{"ok":true}');
    } finally {
      await stop(started);
    }
  });

  it('answers every kernel case the same on Node and on the native binary', async () => {
    const binary = await build(kernelFixture, join(outDir, 'kernel'));
    const node = await startServer(
      [process.execPath, tsxCli, kernelFixture, '0'],
      process.env,
    );
    let native: Started | undefined;
    try {
      native = await startServer([binary, '0'], NO_NODE_ENV);
      for (const c of CASES) {
        const fromNode = await request(node.port, c);
        const fromNative = await request(native.port, c);
        expect(fromNative, c.name).toEqual(fromNode);
      }
      // Pin the Node side too, so "both wrong the same way" can't pass.
      const health = await request(node.port, CASES[0] as Case);
      expect(health).toEqual({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}',
      });
    } finally {
      await stop(node);
      if (native !== undefined) {
        await stop(native);
      }
    }
  });
});

async function build(source: string, binary: string): Promise<string> {
  const result = await runScriptc(
    ['build', source, '-o', binary, '--optimization', 'dev'],
    180_000,
  );
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return binary;
}

async function request(
  port: number,
  c: Case,
): Promise<{ status: number; contentType: string | null; body: string }> {
  const init: RequestInit = { method: c.method };
  if (c.body !== undefined) {
    init.body = c.body;
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await fetch(`http://127.0.0.1:${String(port)}${c.path}`, init);
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    body: await res.text(),
  };
}

function runScriptc(
  args: string[],
  timeoutMs: number,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(scriptcBin, args, {
      cwd: repoRoot,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(
        new Error(
          `scriptc ${args[0] ?? ''} timed out after ${String(timeoutMs)}ms`,
        ),
      );
    }, timeoutMs);
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

function startServer(argv: string[], env: NodeJS.ProcessEnv): Promise<Started> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.reject(new Error('startServer needs a command'));
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(
        new Error(
          `${command} did not print NODUM_PORT. stdout=${stdout} stderr=${stderr}`,
        ),
      );
    }, 20_000);
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      const match = /NODUM_PORT=(\d+)/.exec(stdout);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve({ child: proc, port: Number(match[1]) });
      }
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on('close', (status) => {
      clearTimeout(timer);
      reject(
        new Error(
          `${command} exited ${String(status)} before listen. stdout=${stdout} stderr=${stderr}`,
        ),
      );
    });
  });
}

function stop(started: Started): Promise<void> {
  const { child } = started;
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once('exit', () => {
      resolve();
    });
    child.kill('SIGTERM');
  });
}
