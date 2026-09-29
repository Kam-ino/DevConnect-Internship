import { normalizeUrl } from './normalize-url.js';

export const URL_MAX_LENGTH = 2000;
export const TITLE_MAX_LENGTH = 200;
export const USER_ID_MAX_LENGTH = 128;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001F\u007F]/;
const USER_ID_PATTERN = /^[A-Za-z0-9._:@-]+$/;
const ID_PATTERN = /^[1-9][0-9]{0,14}$/;

const fail = (field, message) => ({ error: { field, message } });
const describe = (value) => (value === null ? 'null' : Array.isArray(value) ? 'an array' : `a ${typeof value}`);

export function validateCreateBody(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail('body', 'request body must be a JSON object; send Content-Type: application/json');
  }

  if (!Object.hasOwn(body, 'url') || body.url === undefined || body.url === null) {
    return fail('url', 'url is required');
  }
  if (typeof body.url !== 'string') {
    return fail('url', `url must be a string, got ${describe(body.url)}`);
  }
  const url = body.url.trim();
  if (url === '') {
    return fail('url', 'url must not be empty');
  }
  if (url.length > URL_MAX_LENGTH) {
    return fail('url', `url must be at most ${URL_MAX_LENGTH} characters, got ${url.length}`);
  }
  if (WHITESPACE_OR_CONTROL.test(url)) {
    return fail('url', 'url must not contain spaces, tabs, newlines or control characters');
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch {
    return fail('url', 'url must be an absolute URL such as https://example.com/page');
  }
  const { protocol } = new URL(normalizedUrl);
  if (!ALLOWED_PROTOCOLS.has(protocol)) {
    return fail('url', `url must use http or https, got ${protocol.slice(0, -1)}`);
  }
  if (normalizedUrl.length > URL_MAX_LENGTH) {
    return fail('url', `url must be at most ${URL_MAX_LENGTH} characters once normalised`);
  }

  let title = null;
  if (Object.hasOwn(body, 'title') && body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') {
      return fail('title', `title must be a string, got ${describe(body.title)}`);
    }
    title = body.title.trim() || null;
    if (title !== null && title.length > TITLE_MAX_LENGTH) {
      return fail('title', `title must be at most ${TITLE_MAX_LENGTH} characters, got ${title.length}`);
    }
  }

  return { value: { url, normalizedUrl, title } };
}

export function validateId(raw) {
  if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) {
    return fail('id', 'id must be a positive integer');
  }
  return { value: Number(raw) };
}

export function validateUserId(raw) {
  const userId = typeof raw === 'string' ? raw.trim() : '';
  if (userId === '') {
    return { status: 401, ...fail('X-User-Id', 'X-User-Id header is required') };
  }
  if (userId.length > USER_ID_MAX_LENGTH) {
    return { status: 400, ...fail('X-User-Id', `X-User-Id must be at most ${USER_ID_MAX_LENGTH} characters`) };
  }
  if (!USER_ID_PATTERN.test(userId)) {
    return { status: 400, ...fail('X-User-Id', 'X-User-Id may only contain letters, digits and . _ : @ -') };
  }
  return { value: userId };
}
