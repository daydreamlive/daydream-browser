export class TypedEventEmitter<EventMap extends { [K in keyof EventMap]: (...args: any[]) => void }> {
  private listeners = new Map<keyof EventMap, Set<(...args: any[]) => void>>();

  on<E extends keyof EventMap>(event: E, handler: EventMap[E]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<E extends keyof EventMap>(event: E, handler: EventMap[E]): this {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  protected emit<E extends keyof EventMap>(
    event: E,
    ...args: Parameters<EventMap[E]>
  ): void {
    this.listeners.get(event)?.forEach((handler) => {
      (handler as (...args: Parameters<EventMap[E]>) => void)(...args);
    });
  }

  protected clearListeners(): void {
    this.listeners.clear();
  }
}

