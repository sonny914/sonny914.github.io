/** A write that did not happen. The message is safe to show to a person. */
export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

/** Loading the household failed. Nothing was changed. */
export class LoadError extends Error {
  constructor(message = 'Couldn’t load the household. Check your connection and try again.') {
    super(message);
    this.name = 'LoadError';
  }
}

/** Demo mode: this browser's storage refused the write. */
export class StorageError extends SaveError {
  constructor(message = 'Couldn’t save. Storage on this device is unavailable or full, so your change was not saved.') {
    super(message);
    this.name = 'StorageError';
  }
}

interface MaybeDbError {
  message?: string;
  code?: string;
  status?: number;
}

const KEEP = 'Your entries are still in the form.';

/** Turns whatever a write threw into a sentence a person can act on. Never claims it saved. */
export function saveErrorMessage(e: unknown): string {
  if (e instanceof SaveError) return e.message;
  const err = (e ?? {}) as MaybeDbError;
  const msg = err.message ?? '';
  if (e instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return `Couldn’t reach the server, so nothing was saved. Check your connection and try again. ${KEEP}`;
  }
  if (err.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return `Couldn’t save: you don’t have permission to make that change. ${KEEP}`;
  }
  if (err.code === '23514' || err.code === '22023') {
    return `Couldn’t save: ${msg.replace(/^.*?:\s*/, '') || 'those details were not accepted.'} ${KEEP}`;
  }
  if (err.status === 401 || err.code === 'PGRST301' || /jwt|not authenticated/i.test(msg)) {
    return `Couldn’t save: you’re signed out. Sign in again, then retry. ${KEEP}`;
  }
  return `Couldn’t save. Your change was not saved. ${KEEP}`;
}
