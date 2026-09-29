import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let api;
beforeEach(async () => {
  if (api) await api.close();
  api = await startServer();
});
after(() => api?.close());

const create = (json, opts) => api.request('POST', '/bookmarks', { json, ...opts });

describe('happy path', () => {
  it('creates, lists, fetches and deletes a bookmark', async () => {
    const created = await create({ url: 'https://example.com/a', title: 'Example' });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('location'), `/bookmarks/${created.body.id}`);
    assert.deepEqual(
      { url: created.body.url, title: created.body.title },
      { url: 'https://example.com/a', title: 'Example' },
    );

    const list = await api.request('GET', '/bookmarks');
    assert.equal(list.status, 200);
    assert.equal(list.body.bookmarks.length, 1);

    const one = await api.request('GET', `/bookmarks/${created.body.id}`);
    assert.equal(one.status, 200);
    assert.deepEqual(one.body, created.body);

    const del = await api.request('DELETE', `/bookmarks/${created.body.id}`);
    assert.equal(del.status, 204);
    assert.equal(del.body, null);

    assert.equal((await api.request('GET', `/bookmarks/${created.body.id}`)).status, 404);
    assert.equal((await api.request('DELETE', `/bookmarks/${created.body.id}`)).status, 404);
  });

  it('title is optional', async () => {
    const res = await create({ url: 'https://example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, null);
  });
});

describe('the four bad URLs from the brief → 400 naming `url`, nothing saved', () => {
  const cases = [
    ['empty string', { url: '' }],
    ['a number', { url: 12345 }],
    ['missing field', { title: 'no url here' }],
    ['a 2 KB URL', { url: 'https://example.com/' + 'a'.repeat(2048 - 20) }],
  ];
  for (const [name, body] of cases) {
    it(name, async () => {
      const res = await create(body);
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.equal(res.body.field, 'url');
      assert.match(res.body.error, /\burl\b/);
      assert.equal(api.rowCount(), 0, 'a row was silently saved');
    });
  }
});

describe('other malformed input → 400 naming the field', () => {
  const cases = [
    ['whitespace-only url', { url: '   ' }, 'url'],
    ['null url', { url: null }, 'url'],
    ['boolean url', { url: true }, 'url'],
    ['object url', { url: { href: 'https://x.com' } }, 'url'],
    ['array url', { url: ['https://x.com'] }, 'url'],
    ['relative url', { url: '/just/a/path' }, 'url'],
    ['no scheme', { url: 'example.com' }, 'url'],
    ['javascript: url', { url: 'javascript:alert(1)' }, 'url'],
    ['ftp url', { url: 'ftp://example.com/file' }, 'url'],
    ['newline inside url', { url: 'https://exa\nmple.com' }, 'url'],
    ['space inside url', { url: 'https://example.com/a b' }, 'url'],
    ['numeric title', { url: 'https://example.com', title: 7 }, 'title'],
    ['too-long title', { url: 'https://example.com', title: 't'.repeat(201) }, 'title'],
    ['body is an array', ['https://example.com'], 'body'],
  ];
  for (const [name, body, field] of cases) {
    it(name, async () => {
      const res = await create(body);
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.equal(res.body.field, field);
      assert.equal(api.rowCount(), 0);
    });
  }

  it('invalid JSON', async () => {
    const res = await api.request('POST', '/bookmarks', { raw: '{"url": ', contentType: 'application/json' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'body');
  });

  it('JSON sent without a JSON content type', async () => {
    const res = await api.request('POST', '/bookmarks', { raw: '{"url":"https://x.com"}', contentType: 'text/plain' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'body');
  });

  it('no body at all', async () => {
    const res = await api.request('POST', '/bookmarks');
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'body');
  });

  it('a non-numeric id', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999999999999']) {
      const res = await api.request('GET', `/bookmarks/${id}`);
      assert.equal(res.status, 400, id);
      assert.equal(res.body.field, 'id');
    }
  });

  it('missing X-User-Id → 401, malformed → 400', async () => {
    const missing = await api.request('GET', '/bookmarks', { user: null });
    assert.equal(missing.status, 401);
    assert.equal(missing.body.field, 'X-User-Id');

    const bad = await api.request('GET', '/bookmarks', { user: 'has spaces' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, 'X-User-Id');
  });

  it('an oversized body → 413, not 500', async () => {
    const res = await create({ url: 'https://example.com/' + 'a'.repeat(20_000) });
    assert.equal(res.status, 413);
    assert.equal(res.body.field, 'body');
  });
});

describe('no input produces a 500', () => {
  const bodies = [
    '', 'null', 'true', '0', '"string"', '[]', '{}', '{"url":{}}', '{"url":[]}', '{"url":1e999}',
    '{"__proto__":{"url":"https://x.com"}}', '{"url":"https://x.com","title":{}}',
    '{"url":"http://[::1"}', '{"url":"https://xn--"}', '{"url":"\\u0000"}', '{"url":"https://x.com/%"}',
    'ÿþ', '{"url": "https://example.com"', 'x'.repeat(50_000),
  ];
  it('survives a pile of hostile bodies', async () => {
    for (const raw of bodies) {
      const res = await api.request('POST', '/bookmarks', { raw, contentType: 'application/json' });
      assert.ok(res.status < 500, `${res.status} for body ${JSON.stringify(raw.slice(0, 60))}`);
    }
  });
});

describe('repeats', () => {
  it('the same create request twice leaves one row', async () => {
    const first = await create({ url: 'https://example.com/page', title: 'First' });
    const second = await create({ url: 'https://example.com/page', title: 'First' });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.id, first.body.id);
    assert.equal(api.rowCount(), 1);
  });

  it('many concurrent identical creates still leave one row', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => create({ url: 'https://example.com/race' })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
    assert.equal(api.rowCount(), 1);
  });

  it('spelling variants of the same URL are recognised as a repeat', async () => {
    const variants = [
      'https://example.com/',
      'HTTPS://EXAMPLE.COM',
      'https://example.com:443',
      '  https://example.com/  ',
      'https://example.com/./',
      'https://example.com/?',
      'https://example.com/#',
    ];
    for (const url of variants) await create({ url });
    assert.equal(api.rowCount(), 1);
  });

  it('a different title does not create a second row, and does not overwrite the first', async () => {
    const first = await create({ url: 'https://example.com', title: 'Original' });
    const again = await create({ url: 'https://example.com', title: 'Changed' });
    assert.equal(again.status, 200);
    assert.equal(again.body.title, 'Original');
    assert.equal(again.body.id, first.body.id);
  });

  it('URLs that may be different pages are kept apart', async () => {
    const distinct = [
      'https://example.com/a',
      'https://example.com/a/',
      'https://example.com/a?x=1',
      'https://example.com/a#section',
      'http://example.com/a',
      'https://www.example.com/a',
      'https://example.com/A',
    ];
    for (const url of distinct) assert.equal((await create({ url })).status, 201, url);
    assert.equal(api.rowCount(), distinct.length);
  });

  it('two users saving the same URL get their own rows', async () => {
    await create({ url: 'https://example.com' }, { user: 'alice' });
    await create({ url: 'https://example.com' }, { user: 'bob' });
    assert.equal(api.rowCount(), 2);
  });
});

describe('isolation between users', () => {
  it('bob cannot list, fetch or delete alice\'s bookmark', async () => {
    const { body } = await create({ url: 'https://example.com' }, { user: 'alice' });
    const bob = { user: 'bob' };
    assert.equal((await api.request('GET', '/bookmarks', bob)).body.bookmarks.length, 0);
    assert.equal((await api.request('GET', `/bookmarks/${body.id}`, bob)).status, 404);
    assert.equal((await api.request('DELETE', `/bookmarks/${body.id}`, bob)).status, 404);
    assert.equal(api.rowCount(), 1);
  });
});

describe('unknown routes', () => {
  it('returns JSON 404', async () => {
    const res = await api.request('PUT', '/bookmarks/1');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });
});

describe('demo page and housekeeping routes', () => {
  it('serves the demo page, /health and the README', async () => {
    const base = api.baseUrl;
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /Acceptance checks/);

    assert.equal((await api.request('GET', '/health', { user: null })).status, 200);

    const readme = await fetch(base + '/README.md');
    assert.equal(readme.status, 200);
    assert.match(await readme.text(), /## How repeats are recognised/);
  });

  it('does not expose other project files', async () => {
    for (const path of ['/package.json', '/src/app.js', '/bookmarks.db']) {
      assert.equal((await fetch(api.baseUrl + path)).status, 404, path);
    }
  });
});
