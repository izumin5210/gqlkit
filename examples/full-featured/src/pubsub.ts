type Listener = (value: unknown) => void;

export class PubSub {
  private listeners = new Map<string, Set<Listener>>();

  publish(topic: string, payload: unknown): void {
    const listeners = this.listeners.get(topic);
    if (listeners) {
      for (const listener of listeners) {
        listener(payload);
      }
    }
  }

  subscribe<T>(topic: string): AsyncIterable<T> {
    const listeners = this.listeners;
    return {
      [Symbol.asyncIterator]() {
        const queue: T[] = [];
        let resolve: (() => void) | null = null;

        const listener: Listener = (value) => {
          queue.push(value as T);
          if (resolve) {
            resolve();
            resolve = null;
          }
        };

        let set = listeners.get(topic);
        if (!set) {
          set = new Set();
          listeners.set(topic, set);
        }
        set.add(listener);

        return {
          next() {
            if (queue.length > 0) {
              return Promise.resolve({
                value: queue.shift() as T,
                done: false,
              });
            }
            return new Promise<IteratorResult<T>>((r) => {
              resolve = () => r({ value: queue.shift() as T, done: false });
            });
          },
          return() {
            const s = listeners.get(topic);
            if (s) {
              s.delete(listener);
              if (s.size === 0) listeners.delete(topic);
            }
            return Promise.resolve({
              value: undefined as unknown as T,
              done: true,
            });
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };
      },
    };
  }
}
