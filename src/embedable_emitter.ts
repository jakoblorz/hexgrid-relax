import { EventEmitter } from 'events';
export class EmbedableEventEmitter<T extends string | symbol> extends EventEmitter {
  emit(event: T, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
  on(event: T, listener: (...args: any[]) => void) {
    return super.on(event, listener);
  }
}