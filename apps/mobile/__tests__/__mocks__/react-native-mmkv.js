// `react-native-mmkv` test stub.
//
// The real package is a JSI-bound native KV store. Persistence tests mock
// `@/lib/db` directly, so this stub only needs to keep module-evaluation
// safe for the `imports.test.ts` smoke suite. Every read returns
// `undefined` (mirroring the "empty cache" branch every consumer handles).
class MMKV {
  constructor() {
    this._mem = new Map();
  }
  set(key, value) {
    this._mem.set(key, value);
  }
  getString(key) {
    const v = this._mem.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getNumber(key) {
    const v = this._mem.get(key);
    return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key) {
    const v = this._mem.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  contains(key) {
    return this._mem.has(key);
  }
  delete(key) {
    this._mem.delete(key);
  }
  getAllKeys() {
    return Array.from(this._mem.keys());
  }
  clearAll() {
    this._mem.clear();
  }
  addOnValueChangedListener() {
    return { remove() {} };
  }
}

module.exports = {
  __esModule: true,
  MMKV,
};
