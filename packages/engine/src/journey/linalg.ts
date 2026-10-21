/** Solves A x = b for a small dense system by Gauss–Jordan with partial pivoting. */
export function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs((m[r] as number[])[c] as number) > Math.abs((m[p] as number[])[c] as number))
        p = r;
    if (Math.abs((m[p] as number[])[c] as number) < 1e-12) throw new Error('Singular matrix');
    [m[c], m[p]] = [m[p] as number[], m[c] as number[]];
    const row = m[c] as number[];
    const pivot = row[c] as number;
    for (let k = c; k <= n; k++) row[k] = (row[k] as number) / pivot;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const other = m[r] as number[];
      const f = other[c] as number;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) other[k] = (other[k] as number) - f * (row[k] as number);
    }
  }
  return m.map((row) => row[n] as number);
}

/** Inverse of a small dense matrix (column by column). */
export function invert(a: number[][]): number[][] {
  const n = a.length;
  const cols = Array.from({ length: n }, (_, j) =>
    solve(
      a,
      Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
    ),
  );
  return Array.from({ length: n }, (_, i) => cols.map((col) => col[i] as number));
}
