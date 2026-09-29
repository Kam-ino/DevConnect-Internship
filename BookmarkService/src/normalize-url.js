/**
 * Turn a URL into the canonical form we use to recognise repeats.
 *
 * We only apply rewrites that are guaranteed not to change which resource the
 * URL points at (RFC 3986 section 6.2.2, plus what the WHATWG URL parser does):
 *
 *   - scheme and host are lower-cased        HTTPS://Example.COM -> https://example.com
 *   - default ports are dropped               https://a.com:443/  -> https://a.com/
 *   - an empty path becomes "/"               https://a.com       -> https://a.com/
 *   - "." and ".." path segments are resolved /a/./b/../c         -> /a/c
 *   - percent-escapes are upper-cased         %2f                 -> %2F
 *   - a dangling "?" or "#" is removed        /page?              -> /page
 *
 * We deliberately do NOT strip query strings, fragments, trailing slashes or
 * "www.", and we do NOT sort query parameters: on real sites those can point
 * at different content, and merging two different bookmarks is worse than
 * keeping two that happen to be the same page. See README "How repeats are
 * recognised".
 *
 * Throws a TypeError if the input is not an absolute URL.
 */
export function normalizeUrl(input) {
  const url = new URL(input);

  // WHATWG keeps an empty "?" / "#" in href; assigning '' removes the delimiter.
  if (url.search === '') url.search = '';
  if (url.hash === '') url.hash = '';

  return url.href.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());
}
