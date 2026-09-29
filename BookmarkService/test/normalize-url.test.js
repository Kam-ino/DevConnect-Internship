import { it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../src/normalize-url.js';

it('normalises only the safe parts', () => {
  const cases = {
    'HTTPS://Example.COM': 'https://example.com/',
    'https://example.com:443/a': 'https://example.com/a',
    'http://example.com:80/a': 'http://example.com/a',
    'https://example.com/a/./b/../c': 'https://example.com/a/c',
    'https://example.com/%7euser': 'https://example.com/%7Euser',
    'https://example.com/page?': 'https://example.com/page',
    'https://example.com/page#': 'https://example.com/page',
    // left alone on purpose:
    'https://example.com/a/': 'https://example.com/a/',
    'https://example.com/A?b=2&a=1#top': 'https://example.com/A?b=2&a=1#top',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(normalizeUrl(input), expected, input);
  }
});

it('throws on non-URLs', () => {
  assert.throws(() => normalizeUrl('not a url'));
  assert.throws(() => normalizeUrl('/relative'));
});
