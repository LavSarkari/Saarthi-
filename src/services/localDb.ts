import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "local_db.json");

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface LocalDb {
  userSettings: Record<string, any>;
  telegramLinks: Record<string, any>;
  tasks: Record<string, any>; // taskId -> task
}

export let dbData: LocalDb = {
  userSettings: {},
  telegramLinks: {},
  tasks: {}
};

// Load existing data from file if present
if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    if (raw && raw.trim().length > 0) {
      dbData = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading local DB file on startup, starting fresh:", e);
  }
}

export function saveDb() {
  try {
    const tempDir = path.dirname(DB_PATH);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf8");
  } catch (e) {
    console.error("Error writing to local DB file:", e);
  }
}

class MockDoc {
  public id: string;
  constructor(public collectionName: string, public docId: string) {
    this.id = docId;
  }

  async get() {
    const col = dbData[this.collectionName as keyof LocalDb] || {};
    const exists = this.docId in col;
    const dataVal = col[this.docId];
    return {
      exists,
      id: this.docId,
      data: () => dataVal ? JSON.parse(JSON.stringify(dataVal)) : undefined,
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (!dbData[this.collectionName as keyof LocalDb]) {
      (dbData as any)[this.collectionName] = {};
    }
    const col = dbData[this.collectionName as keyof LocalDb];
    if (options?.merge && col[this.docId]) {
      col[this.docId] = { ...col[this.docId], ...data };
    } else {
      col[this.docId] = data;
    }
    saveDb();
  }

  async update(data: any) {
    const col = dbData[this.collectionName as keyof LocalDb];
    if (col && col[this.docId]) {
      for (const [key, val] of Object.entries(data)) {
        if (val === "DELETE_FIELD") {
          delete col[this.docId][key];
        } else {
          col[this.docId][key] = val;
        }
      }
      saveDb();
    }
  }

  async delete() {
    const col = dbData[this.collectionName as keyof LocalDb];
    if (col && col[this.docId]) {
      delete col[this.docId];
      saveDb();
    }
  }
}

class MockQuery {
  constructor(
    private collectionName: string,
    private filters: Array<{ field: string; op: string; val: any }> = [],
    private limitVal?: number
  ) {}

  where(field: string, op: string, val: any) {
    return new MockQuery(this.collectionName, [...this.filters, { field, op, val }], this.limitVal);
  }

  limit(n: number) {
    return new MockQuery(this.collectionName, this.filters, n);
  }

  async get() {
    const col = dbData[this.collectionName as keyof LocalDb] || {};
    let docs = Object.entries(col).map(([id, data]) => ({ id, data: JSON.parse(JSON.stringify(data)) }));

    // Apply filters
    for (const filter of this.filters) {
      docs = docs.filter((doc: any) => {
        const fieldVal = doc.data[filter.field];
        if (filter.op === "==") {
          return String(fieldVal) === String(filter.val);
        }
        return true;
      });
    }

    if (this.limitVal !== undefined) {
      docs = docs.slice(0, this.limitVal);
    }

    return {
      empty: docs.length === 0,
      docs: docs.map(d => ({
        id: d.id,
        data: () => d.data
      }))
    };
  }
}

class MockCollection {
  constructor(private collectionName: string) {}

  doc(id?: string) {
    return new MockDoc(this.collectionName, id || Math.random().toString(36).substring(2, 15));
  }

  where(field: string, op: string, val: any) {
    return new MockQuery(this.collectionName, [{ field, op, val }]);
  }

  async get() {
    return new MockQuery(this.collectionName).get();
  }
}

class MockBatch {
  private operations: Array<() => void> = [];
  set(docRef: any, data: any, options?: any) {
    this.operations.push(() => {
      if (!dbData[docRef.collectionName as keyof LocalDb]) {
        (dbData as any)[docRef.collectionName] = {};
      }
      const col = dbData[docRef.collectionName as keyof LocalDb];
      if (options?.merge && col[docRef.docId]) {
        col[docRef.docId] = { ...col[docRef.docId], ...data };
      } else {
        col[docRef.docId] = data;
      }
    });
    return this;
  }
  update(docRef: any, data: any) {
    this.operations.push(() => {
      const col = dbData[docRef.collectionName as keyof LocalDb];
      if (col && col[docRef.docId]) {
        for (const [key, val] of Object.entries(data)) {
          if (val === "DELETE_FIELD") {
            delete col[docRef.docId][key];
          } else {
            col[docRef.docId][key] = val;
          }
        }
      }
    });
    return this;
  }
  delete(docRef: any) {
    this.operations.push(() => {
      const col = dbData[docRef.collectionName as keyof LocalDb];
      if (col && col[docRef.docId]) {
        delete col[docRef.docId];
      }
    });
    return this;
  }
  async commit() {
    for (const op of this.operations) {
      op();
    }
    saveDb();
  }
}

export const mockFirestore = {
  collection(name: string) {
    return new MockCollection(name);
  },
  batch() {
    return new MockBatch();
  }
};

export const MockFieldValue = {
  delete() {
    return "DELETE_FIELD";
  }
};
