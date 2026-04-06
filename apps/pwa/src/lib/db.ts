import Dexie, { type Table } from "dexie";

type KvRow = {
  key: string;
  value: unknown;
};

class WeavePwaDb extends Dexie {
  kv!: Table<KvRow, string>;

  constructor() {
    super("weavenyc-pwa");
    this.version(1).stores({
      kv: "&key"
    });
  }
}

let instance: WeavePwaDb | null = null;

export function getPwaDb() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!instance) {
    instance = new WeavePwaDb();
  }

  return instance;
}
