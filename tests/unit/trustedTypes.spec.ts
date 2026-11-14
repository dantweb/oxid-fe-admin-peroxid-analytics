import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * peroxid-admin sends `require-trusted-types-for 'script'` and allows only its own policies. A string that becomes
 * HTML or a document (innerHTML, DOMParser …) is blocked there, while the harness and jsdom accept it. So the sources
 * of this plugin never use such a sink; they build elements with DOM calls.
 */
const SINKS =
  /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|document\.write|srcdoc)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|vue)$/.test(name) ? [path] : [];
  });
}

describe('Trusted Types', () => {
  it('no source of the plugin uses an HTML-string sink', () => {
    const offenders = sources('src').filter((file) => SINKS.test(readFileSync(file, 'utf-8')));

    expect(offenders).toEqual([]);
  });
});
