import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
function luminance(rgb) {
  return rgb.map((c) => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; })
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
for (const [mode, block] of [...css.matchAll(/:root(\.dark)?\s*\{([^}]+)\}/g)].map((m) => [m[1] ? 'dark' : 'light', m[2]])) {
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+)/g)].map((m) => [m[1], m.slice(2).map(Number)]));
  test(`${mode}: primary copy and button labels have at least 4.5:1 contrast`, () => {
    for (const [fg, bg] of [[tokens.ink, tokens.page], [tokens.ink, tokens.surface], [tokens.ink, tokens.field], [tokens['field-placeholder'], tokens.field], [[255,255,255], tokens.core], [[13,31,22], tokens.turquoise], [[13,31,22], tokens.accent]]) {
      assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
    }
  });
}
