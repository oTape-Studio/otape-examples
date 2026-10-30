/**
 * A minimal typed event emitter.
 *
 * `Events` maps event names to payload types, so `on('change', listener)`
 * knows exactly what the listener receives.
 */

type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  readonly #listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Subscribe. Returns a function that unsubscribes. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }
    listeners.add(listener);
    return () => {
      this.off(type, listener);
    };
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.#listeners.get(type)?.delete(listener);
  }

  protected emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      (listener as Listener<Events[K]>)(payload);
    }
  }
}
