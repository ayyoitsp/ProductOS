type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitDataChange(): void {
  for (const l of Array.from(listeners)) l();
}
