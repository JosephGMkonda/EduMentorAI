const listeners = new Set<() => void>();

export function subscribeStopReading(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function requestStopReading(): void {
  listeners.forEach((fn) => fn());
}
