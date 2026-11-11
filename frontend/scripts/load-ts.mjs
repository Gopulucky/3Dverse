import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Transpile a TypeScript module (and the relative modules it imports) into a
 * temp directory and import it. `path` is relative to `frontend/`.
 * Dependency-free on purpose: the repo's other unit tests do the same in memory.
 */
export async function loadTs(path) {
  const outDir = join(tmpdir(), `3dverse-ts-${createHash('sha1').update(frontendRoot).digest('hex').slice(0, 10)}`);
  mkdirSync(outDir, { recursive: true });
  const done = new Map();

  function emit(absSource) {
    if (done.has(absSource)) return done.get(absSource);
    const out = join(outDir, createHash('sha1').update(absSource).digest('hex').slice(0, 8) + '-' + basename(absSource).replace(/\.tsx?$/, '.mjs'));
    done.set(absSource, out);
    const source = readFileSync(absSource, 'utf8');
    const rewritten = source.replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (_, a, rel, c) => {
      const base = resolve(dirname(absSource), rel);
      const target = [base + '.ts', base + '.tsx', join(base, 'index.ts')].find(existsSync);
      if (!target) throw new Error(`loadTs: cannot resolve ${rel} from ${absSource}`);
      return a + pathToFileURL(emit(target)).href + c;
    });
    const js = ts.transpileModule(rewritten, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    writeFileSync(out, js);
    return out;
  }

  const entry = emit(resolve(frontendRoot, path));
  return import(pathToFileURL(entry).href);
}
