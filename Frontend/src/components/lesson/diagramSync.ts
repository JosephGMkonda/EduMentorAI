const listeners = new Set<(parts: Map<Element, number>) => void>();

export function subscribeActiveParts(
  fn: (parts: Map<Element, number>) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function publishActiveParts(parts: Map<Element, number>): void {
  listeners.forEach((fn) => fn(parts));
}
