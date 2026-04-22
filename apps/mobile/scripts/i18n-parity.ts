#!/usr/bin/env tsx
/**
 * i18n parity validator.
 *
 * Walks `apps/mobile/src/locales/{en,es,zh-Hans}/*.json` and asserts that
 *   - every namespace JSON exists in all 3 locales,
 *   - every key present in the EN bundle also exists in ES + ZH (and
 *     vice-versa — we want zero drift in either direction).
 *
 * Exits 1 with a markdown-style summary table if any locale is missing a key
 * or file. Exits 0 silently otherwise (except a one-line summary when run
 * interactively).
 *
 * Wire into CI with:
 *   pnpm -F @weavenyc/mobile run i18n:parity
 *
 * The script is zero-dep: Node stdlib only so it stays callable pre-install.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const LOCALES = ['en', 'es', 'zh-Hans'] as const;
type Locale = (typeof LOCALES)[number];

const ROOT = path.resolve(__dirname, '..', 'src', 'locales');

interface Issue {
  namespace: string;
  locale: Locale;
  key: string;
  kind: 'missing-file' | 'missing-key' | 'empty-value';
}

function listNamespaces(locale: Locale): string[] {
  const dir = path.join(ROOT, locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

function loadNamespace(locale: Locale, namespace: string): Record<string, string> | null {
  const file = path.join(ROOT, locale, `${namespace}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[parity] ${file} is not valid JSON: ${(e as Error).message}`);
    process.exit(2);
  }
}

function main(): void {
  // Union of namespaces across locales — any locale-missing namespace is an issue.
  const namespaces = new Set<string>();
  for (const locale of LOCALES) {
    for (const ns of listNamespaces(locale)) namespaces.add(ns);
  }

  const issues: Issue[] = [];

  for (const namespace of [...namespaces].sort()) {
    // Collect key union for this namespace
    const keysByLocale: Record<Locale, Set<string>> = {
      en: new Set(),
      es: new Set(),
      'zh-Hans': new Set(),
    };
    const bags: Record<Locale, Record<string, string> | null> = {
      en: loadNamespace('en', namespace),
      es: loadNamespace('es', namespace),
      'zh-Hans': loadNamespace('zh-Hans', namespace),
    };
    for (const locale of LOCALES) {
      const bag = bags[locale];
      if (bag === null) {
        issues.push({ namespace, locale, key: '(file)', kind: 'missing-file' });
      } else {
        for (const k of Object.keys(bag)) keysByLocale[locale].add(k);
      }
    }
    const union = new Set<string>([
      ...keysByLocale.en,
      ...keysByLocale.es,
      ...keysByLocale['zh-Hans'],
    ]);
    for (const key of union) {
      for (const locale of LOCALES) {
        const bag = bags[locale];
        if (bag === null) continue; // already counted as missing-file
        if (!(key in bag)) {
          issues.push({ namespace, locale, key, kind: 'missing-key' });
          continue;
        }
        const val = bag[key];
        if (typeof val !== 'string' || val.length === 0) {
          issues.push({ namespace, locale, key, kind: 'empty-value' });
        }
      }
    }
  }

  if (issues.length === 0) {
    const totalKeys = LOCALES.reduce((acc, locale) => {
      let count = 0;
      for (const ns of listNamespaces(locale)) {
        const bag = loadNamespace(locale, ns);
        if (bag) count += Object.keys(bag).length;
      }
      return acc + count;
    }, 0);
    console.log(
      `[parity] OK — ${[...namespaces].length} namespaces × 3 locales · ${totalKeys} total leaf values`,
    );
    process.exit(0);
  }

  console.error(`[parity] FAIL — ${issues.length} issue(s):\n`);
  console.error('| namespace | locale | key | kind |');
  console.error('| --- | --- | --- | --- |');
  for (const issue of issues) {
    console.error(`| ${issue.namespace} | ${issue.locale} | ${issue.key} | ${issue.kind} |`);
  }
  process.exit(1);
}

main();
