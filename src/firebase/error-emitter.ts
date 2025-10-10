
import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

class TypedEventEmitter extends EventEmitter {
  emit<T extends keyof ErrorEvents>(event: T, ...args: Parameters<ErrorEvents[T]>) {
    return super.emit(event, ...args);
  }

  on<T extends keyof ErrorEvents>(event: T, listener: ErrorEvents[T]) {
    return super.on(event, listener);
  }

  off<T extends keyof ErrorEvents>(event: T, listener: ErrorEvents[T]) {
    return super.off(event, listener);
  }
}

export const errorEmitter = new TypedEventEmitter();
