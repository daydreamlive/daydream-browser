type TransitionMap<S extends string> = Record<S, S[]>;

export interface StateMachine<S extends string> {
  readonly current: S;
  can(next: S): boolean;
  transition(next: S): boolean;
  force(next: S): void;
}

export function createStateMachine<S extends string>(
  initial: S,
  transitions: TransitionMap<S>,
  onChange?: (from: S, to: S) => void,
): StateMachine<S> {
  let current = initial;

  return {
    get current() {
      return current;
    },
    can(next: S) {
      return transitions[current].includes(next);
    },
    transition(next: S): boolean {
      if (!transitions[current].includes(next)) return false;
      const prev = current;
      current = next;
      onChange?.(prev, next);
      return true;
    },
    force(next: S) {
      const prev = current;
      current = next;
      onChange?.(prev, next);
    },
  };
}
