import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContextState = {
  requestId: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export function runWithRequestContext<T>(state: RequestContextState, callback: () => T): T {
  return requestContextStorage.run(state, callback);
}

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function getRequestId() {
  return getRequestContext()?.requestId ?? 'background';
}
