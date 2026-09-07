// Guards against documentation bloat. Every threshold lives in
// docs/budgets.json; raising one is a deliberate, reviewable diff, not a
// side effect of the change that needed the room.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGETS_PATH = 'docs/budgets.json';
const RAISE = `Budgets live in ${BUDGETS_PATH}; raising one is a deliberate, reviewable diff.`;

interface Budgets {
  lines: Record<string, number>;
  prose: { keys: string[]; maxChars: number; grandfathered: string[] };
  narration: {
    patterns: string[];
    headerPatterns: string[];
    grandfathered: Record<string, string[]>;
  };
  voice: { words: string[]; phrases: string[]; allow: string[]; count: string[] };
  headers: { maxLines: number; grandfathered: Record<string, number> };
}

const budgets: Budgets = JSON.parse(readFileSync(join(ROOT, BUDGETS_PATH), 'utf8'));

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const lineCount = (text: string): number => text.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '').length;

function walk(dir: string, keep: (rel: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel, keep));
    else if (keep(rel)) out.push(rel);
  }
  return out.sort();
}

const docsMd = walk('docs', (f) => f.endsWith('.md'));
const researchTs = walk('research', (f) => f.endsWith('.ts'));
const srcTs = walk('src', (f) => f.endsWith('.ts'));
const testTs = walk('test', (f) => f.endsWith('.test.ts'));
const proseJson = [...walk('research', (f) => f.endsWith('.json')), ...walk('docs', (f) => f.endsWith('.json'))];
const researchReadmes = walk('research', (f) => f.endsWith('README.md'));

// A README is generated if a research script writes it. Read that off the
// scripts: `const X = join(Y, 'name')` chains rooted at the script's own
// directory, then `writeFileSync(X`. Anything else is hand-written.
function generatedFiles(): Set<string> {
  const out = new Set<string>();
  for (const script of researchTs) {
    const src = read(script);
    const here = dirname(script);
    const paths = new Map<string, string>();
    for (const m of src.matchAll(/const (\w+) = dirname\(fileURLToPath\(import\.meta\.url\)\)/g)) {
      paths.set(m[1], here);
    }
    for (const m of src.matchAll(/const (\w+) = join\((\w+), '([^']+)'\)/g)) {
      const base = paths.get(m[2]);
      if (base !== undefined) paths.set(m[1], join(base, m[3]));
    }
    for (const m of src.matchAll(/writeFileSync\((\w+)[,)]/g)) {
      const target = paths.get(m[1]);
      if (target !== undefined) out.add(relative(ROOT, resolve(ROOT, target)));
    }
  }
  return out;
}

const generated = generatedFiles();
const handWrittenMd = ['README.md', ...docsMd, ...researchReadmes.filter((f) => !generated.has(f))];

// Leading comment block of a TS file: consecutive `//` lines, or one `/* */`.
function headerComment(text: string): string[] {
  const lines = text.split('\n');
  if (lines[0]?.startsWith('/*')) {
    const end = lines.findIndex((l) => l.includes('*/'));
    return lines.slice(0, end + 1);
  }
  const out: string[] = [];
  for (const l of lines) {
    if (!l.startsWith('//')) break;
    out.push(l);
  }
  return out;
}

function commentLineCount(text: string): number {
  let n = 0;
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (inBlock) {
      n++;
      if (l.includes('*/')) inBlock = false;
    } else if (l.startsWith('//')) n++;
    else if (l.startsWith('/*')) {
      n++;
      if (!l.includes('*/')) inBlock = true;
    }
  }
  return n;
}

// JSON prose fields under the budgeted keys, with their paths.
function proseFields(file: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) node.forEach((v, i) => visit(v, `${path}[${i}]`));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        const p = `${path}.${k}`;
        if (budgets.prose.keys.includes(k)) {
          if (typeof v === 'string') out.push({ path: p, text: v });
          else if (Array.isArray(v)) {
            v.forEach((s, i) => typeof s === 'string' && out.push({ path: `${p}[${i}]`, text: s }));
          }
        }
        visit(v, p);
      }
    }
  };
  visit(JSON.parse(read(file)), '$');
  return out;
}

function testTitles(file: string): string[] {
  return [...read(file).matchAll(/\b(?:describe|it|test)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
}

function findAll(text: string, patterns: string[], flags = 'g'): string[] {
  return patterns.flatMap((p) => [...text.matchAll(new RegExp(p, flags))].map((m) => m[0]));
}

function unexpected(file: string, hits: string[], grandfathered: Record<string, string[]>): string[] {
  const allowed = [...(grandfathered[file] ?? [])];
  return hits.filter((h) => {
    const i = allowed.indexOf(h);
    if (i === -1) return true;
    allowed.splice(i, 1);
    return false;
  });
}

describe('docs/budgets.json', () => {
  it('names only files that exist, and budgets every hand-written doc', () => {
    for (const f of Object.keys(budgets.lines)) expect(handWrittenMd, `${f} in budgets but not on disk`).toContain(f);
    for (const f of handWrittenMd) expect(budgets.lines, `${f} has no line budget. ${RAISE}`).toHaveProperty(f);
  });

  it('is itself within the prose cap', () => {
    for (const { path, text } of proseFields(BUDGETS_PATH)) expect(text.length, path).toBeLessThanOrEqual(budgets.prose.maxChars);
  });
});

describe('line budgets', () => {
  for (const [file, max] of Object.entries(budgets.lines)) {
    it(`${file} <= ${max} lines`, () => {
      const n = lineCount(read(file));
      expect(n, `${file} is ${n} lines, budget ${max}. ${RAISE}`).toBeLessThanOrEqual(max);
    });
  }
});

describe('JSON prose caps', () => {
  for (const file of proseJson) {
    it(`${file} prose fields <= ${budgets.prose.maxChars} chars`, () => {
      for (const { path, text } of proseFields(file)) {
        const id = `${file}:${path}`;
        if (budgets.prose.grandfathered.includes(id)) continue;
        expect(text.length, `${id} is ${text.length} chars. ${RAISE}`).toBeLessThanOrEqual(budgets.prose.maxChars);
      }
    });
  }
});

describe('no session narration', () => {
  const md = budgets.narration.patterns;
  const ts = [...md, ...budgets.narration.headerPatterns];

  for (const file of handWrittenMd) {
    it(`${file}`, () => {
      expect(unexpected(file, findAll(read(file), md, 'gi'), budgets.narration.grandfathered)).toEqual([]);
    });
  }
  for (const file of proseJson) {
    it(`${file} prose fields`, () => {
      const hits = proseFields(file).flatMap(({ text }) => findAll(text, md, 'gi'));
      expect(unexpected(file, hits, budgets.narration.grandfathered)).toEqual([]);
    });
  }
  for (const file of testTs) {
    it(`${file} test titles`, () => {
      const hits = testTitles(file).flatMap((t) => findAll(t, md, 'gi'));
      expect(unexpected(file, hits, budgets.narration.grandfathered)).toEqual([]);
    });
  }
  for (const file of researchTs) {
    it(`${file} header comment`, () => {
      const header = headerComment(read(file)).join('\n');
      expect(unexpected(file, findAll(header, ts, 'gi'), budgets.narration.grandfathered)).toEqual([]);
    });
  }
});

describe('model-voice words', () => {
  const wordPattern = budgets.voice.words.map((w) => `\\b${w.replace(/[.*+?^${}()|[\\]\\\\-]/g, '\\$&')}\\b`);
  const check = (file: string, text: string): void => {
    let stripped = text;
    for (const a of budgets.voice.allow) stripped = stripped.split(a).join('');
    const hits = [...findAll(stripped, wordPattern, 'gi'), ...findAll(stripped, budgets.voice.phrases, 'gm')];
    expect(hits, `${file}: replace with something plainer`).toEqual([]);
    for (const phrase of budgets.voice.count) {
      const n = findAll(stripped, [`\\b${phrase}\\b`], 'gi').length;
      if (n > 0) console.log(`${file}: "${phrase}" x${n}`);
    }
  };
  for (const file of handWrittenMd) it(`${file}`, () => check(file, read(file)));
  for (const file of proseJson) {
    it(`${file} prose fields`, () => check(file, proseFields(file).map(({ text }) => text).join('\n')));
  }
});

describe('comment density', () => {
  for (const file of [...researchTs, ...srcTs]) {
    it(`${file}`, () => {
      const text = read(file);
      const total = lineCount(text);
      const comments = commentLineCount(text);
      const header = headerComment(text).length;
      console.log(`${file}: ${comments}/${total} comment lines (${((100 * comments) / Math.max(total, 1)).toFixed(0)}%), header ${header}`);
      const max = budgets.headers.grandfathered[file] ?? budgets.headers.maxLines;
      expect(header, `${file} header comment is ${header} lines, cap ${max}. ${RAISE}`).toBeLessThanOrEqual(max);
    });
  }
});
