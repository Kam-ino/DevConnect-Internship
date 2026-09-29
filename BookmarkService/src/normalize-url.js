export function normalizeUrl(input) {
  const url = new URL(input);

  if (url.search === '') url.search = '';
  if (url.hash === '') url.hash = '';

  return url.href.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());
}
