import type { Gate, GateStatus, SubjectKey, SubjectSet } from '@margwise/contracts';

export interface GateResult {
  status: GateStatus;
  /** Required subjects the student does not take. */
  missingAllOf: SubjectKey[];
  /** `anyOf` groups with no subject taken. */
  unmetAnyOf: SubjectKey[][];
}

/** Evaluates one sourced subject rule against the student's subjects (D-024). */
export function evaluateGate(gate: Gate, student: SubjectSet): GateResult {
  const taken = new Set(student.subjects);
  const missingAllOf = gate.requirement.allOf.filter((s) => !taken.has(s));
  const unmetAnyOf = gate.requirement.anyOf.filter((group) => !group.some((s) => taken.has(s)));
  const met = missingAllOf.length === 0 && unmetAnyOf.length === 0;
  return { status: met ? 'OPEN' : gate.whenUnmet, missingAllOf, unmetAnyOf };
}

/**
 * Picks the gate for the student's board (board-specific beats all-boards)
 * and evaluates it. `null` means no reviewed rule exists for this board: the
 * UI says so rather than assuming the route is open.
 */
export function evaluateRoute(gates: readonly Gate[], student: SubjectSet): GateResult | null {
  const gate =
    gates.find((g) => g.board === student.board) ?? gates.find((g) => g.board === undefined);
  return gate ? evaluateGate(gate, student) : null;
}
