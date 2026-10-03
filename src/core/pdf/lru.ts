// LRU mínima sobre el orden de inserción de Map.
export class LRU<V> {
  private map = new Map<string, V>();
  constructor(
    private max: number,
    private onEvict?: (value: V) => void,
  ) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const [oldest, v] = this.map.entries().next().value!;
      this.map.delete(oldest);
      this.onEvict?.(v);
    }
  }

  delete(key: string) {
    this.map.delete(key);
  }

  clear() {
    for (const v of this.map.values()) this.onEvict?.(v);
    this.map.clear();
  }
}
