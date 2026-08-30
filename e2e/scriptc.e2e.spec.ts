import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixture = join(repoRoot, 'e2e/fixtures/health.ts');
const scriptcBin = join(repoRoot, 'node_modules/.bin/scriptc');

describe('[e2e] scriptc', () => {
  let child: ReturnType<typeof spawn> | undefined;
  let outDir: string | undefined;

  afterEach(async () => {
    if (child !== undefined && child.pid !== undefined && !child.killed) {
      child.kill('SIGTERM');
      child = undefined;
    }
    if (outDir !== undefined) {
      await rm(outDir, { recursive: true, force: true });
      outDir = undefined;
    }
  });

  it('reports fully static coverage with no --dynamic remainder', async () => {
    const result = await runScriptc(['coverage', fixture], 30_000);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(/not analyzable/i);
    expect(result.stdout).toMatch(/fully static/i);
    expect(result.stdout).toMatch(/\(100%\)/);
    expect(result.stdout).not.toMatch(/runs with --dynamic/);
  });

  it('builds a native binary that answers GET /health with {ok:true}', async () => {
    outDir = await mkdtemp(join(tmpdir(), 'nodum-scriptc-'));
    const binary = join(outDir, 'health');
    const build = await runScriptc(
      [
        'build',
        fixture,
        '-o',
        binary,
        '--optimization',
        'dev',
        '--backend',
        'llvm',
      ],
      120_000,
    );
    expect(build.status, build.stderr || build.stdout).toBe(0);
    const started = await startBinary(binary);
    child = started.child;
    const res = await fetch(`http://127.0.0.1:${started.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
  });
});

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

function startBinary(
  binary: string,
): Promise<{ child: ReturnType<typeof spawn>; port: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, ['0'], { env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(
        new Error(
          `binary did not print NODUM_PORT. stdout=${stdout} stderr=${stderr}`,
        ),
      );
    }, 10_000);
    const onData = (chunk: Buffer): void => {
      stdout += chunk.toString('utf8');
      const match = /NODUM_PORT=(\d+)/.exec(stdout);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve({ child: proc, port: Number(match[1]) });
      }
    };
    proc.stdout.on('data', onData);
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
          `binary exited ${String(status)} before listen. stdout=${stdout} stderr=${stderr}`,
        ),
      );
    });
  });
}
