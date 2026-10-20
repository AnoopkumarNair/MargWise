/**
 * PII denylist (04 §6.2, §6.4). Keys are normalised (lowercase, separators
 * removed) before matching, so `user_agent`, `userAgent` and `UserAgent`
 * are all caught. A test fails if any telemetry schema gains a matching key.
 */
const EXACT = new Set([
  'name',
  'age',
  'ip',
  'lat',
  'lng',
  'geo',
  'pan',
  'dob',
  'contact',
  'contacts',
]);
const CONTAINS = [
  'firstname',
  'lastname',
  'fullname',
  'surname',
  'email',
  'phone',
  'mobile',
  'school',
  'address',
  'dateofbirth',
  'birth',
  'exactage',
  'latitude',
  'longitude',
  'geolocation',
  'ipaddress',
  'useragent',
  'fingerprint',
  'deviceid',
  'aadhaar',
  'aadhar',
  'passport',
  'whatsapp',
];
const SUFFIX = ['income']; // `incomeBand` is allowed (bands only); `income`, `annualIncome` are not.

const normalise = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

export function isPiiKey(key: string): boolean {
  const k = normalise(key);
  if (EXACT.has(k)) return true;
  if (CONTAINS.some((c) => k.includes(c))) return true;
  if (SUFFIX.some((s) => k.endsWith(s))) return true;
  return /^(first|last|full|user|display|child|parent|student)?name$/.test(k);
}

/** Paths (dot-joined) of every PII-like key anywhere in a JSON value. */
export function findPiiKeysInValue(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value))
    return value.flatMap((v, i) => findPiiKeysInValue(v, [...path, String(i)]));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [
    ...(isPiiKey(k) ? [[...path, k].join('.')] : []),
    ...findPiiKeysInValue(v, [...path, k]),
  ]);
}

type JsonSchema = { [key: string]: unknown };

/** Property names matching the denylist anywhere in a JSON Schema. */
export function findPiiKeysInJsonSchema(schema: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    const s = node as JsonSchema;
    if (s.properties && typeof s.properties === 'object') {
      for (const [k, v] of Object.entries(s.properties)) {
        if (isPiiKey(k)) found.add(k);
        visit(v);
      }
    }
    for (const key of [
      'items',
      'anyOf',
      'oneOf',
      'allOf',
      'additionalProperties',
      'prefixItems',
    ] as const)
      visit(s[key]);
    for (const defs of [s.$defs, s.definitions])
      if (defs && typeof defs === 'object') Object.values(defs).forEach(visit);
  };
  visit(schema);
  return [...found];
}
