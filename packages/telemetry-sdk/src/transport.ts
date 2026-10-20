export interface Transport {
  post(path: string, body: unknown): Promise<{ status: number }>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Default transport. No cookies, no referrer: the request carries only the payload. */
export function fetchTransport(
  endpoint: string,
  fetchFn: FetchLike = (i, init) => globalThis.fetch(i, init),
): Transport {
  return {
    async post(path, body) {
      const res = await fetchFn(`${endpoint}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
      });
      return { status: res.status };
    },
  };
}
