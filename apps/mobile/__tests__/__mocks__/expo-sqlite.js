// `expo-sqlite` test stub.
//
// The real package ships a native SQLite bridge. Persistence tests
// (`persistence.test.ts`) mock `@/lib/db` wholesale, so the stub here only
// needs to keep module-evaluation safe for the `imports.test.ts` smoke
// suite and for any downstream file that does an unreferenced `import`.
// Every handle method resolves a harmless empty value.

function openDatabaseSync() {
  return {
    execAsync: () => Promise.resolve(),
    runAsync: () => Promise.resolve({ lastInsertRowId: 0, changes: 0 }),
    getFirstAsync: () => Promise.resolve(null),
    getAllAsync: () => Promise.resolve([]),
    prepareAsync: () =>
      Promise.resolve({
        executeAsync: () => Promise.resolve({ getAllAsync: () => Promise.resolve([]) }),
        finalizeAsync: () => Promise.resolve(),
      }),
    closeAsync: () => Promise.resolve(),
    withTransactionAsync: async (cb) => {
      await cb();
    },
  };
}

function openDatabaseAsync() {
  return Promise.resolve(openDatabaseSync());
}

module.exports = {
  __esModule: true,
  openDatabaseSync,
  openDatabaseAsync,
};
