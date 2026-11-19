import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';

interface StorePayload {
  version: number;
  updatedAt: string;
  deletedIds: Record<string, string[]>;
  staff: unknown[];
  incomingDocs: unknown[];
  outgoingDocs: unknown[];
  leaveRequests: unknown[];
  medicalItems: unknown[];
  medicalLoans: unknown[];
  kitchenItems: unknown[];
  kitchenLoans: unknown[];
  vehicles: unknown[];
  vehicleInspections: unknown[];
  repairs: unknown[];
  pavilionRequests: unknown[];
  fireReliefRequests: unknown[];
  notifications: unknown[];
  settings: Record<string, unknown> | null;
}

const COLLECTION_TO_STATE_KEY: Record<string, keyof StorePayload> = {
  incoming_docs: 'incomingDocs',
  outgoing_docs: 'outgoingDocs',
  leave_requests: 'leaveRequests',
  medical_items: 'medicalItems',
  medical_loans: 'medicalLoans',
  kitchen_items: 'kitchenItems',
  kitchen_loans: 'kitchenLoans',
  vehicles: 'vehicles',
  vehicle_inspections: 'vehicleInspections',
  repairs: 'repairs',
  pavilion_requests: 'pavilionRequests',
  fire_relief_requests: 'fireReliefRequests',
  notifications: 'notifications',
};

const ARRAY_KEYS: (keyof StorePayload)[] = [
  'staff',
  'incomingDocs',
  'outgoingDocs',
  'leaveRequests',
  'medicalItems',
  'medicalLoans',
  'kitchenItems',
  'kitchenLoans',
  'vehicles',
  'vehicleInspections',
  'repairs',
  'pavilionRequests',
  'fireReliefRequests',
  'notifications',
];

function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.cwd() === '/app' || fs.existsSync('/app/data')) {
    return '/app/data';
  }
  return path.resolve(process.cwd(), 'data');
}

const DATA_DIR = resolveDataDir();
const STORE_FILE = path.join(DATA_DIR, 'eoffice-store.json');
const BACKUP_FILE = path.join(DATA_DIR, 'eoffice-store.bak.json');

function createEmptyStore(): StorePayload {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    deletedIds: {},
    staff: [],
    incomingDocs: [],
    outgoingDocs: [],
    leaveRequests: [],
    medicalItems: [],
    medicalLoans: [],
    kitchenItems: [],
    kitchenLoans: [],
    vehicles: [],
    vehicleInspections: [],
    repairs: [],
    pavilionRequests: [],
    fireReliefRequests: [],
    notifications: [],
    settings: null,
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStoreFromDisk(): StorePayload {
  ensureDataDir();
  const tryParse = (filePath: string): StorePayload | null => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StorePayload>;
      if (!parsed || typeof parsed !== 'object') return null;
      const base = createEmptyStore();
      return {
        ...base,
        ...parsed,
        deletedIds: parsed.deletedIds && typeof parsed.deletedIds === 'object' ? parsed.deletedIds : {},
      };
    } catch {
      return null;
    }
  };

  return tryParse(STORE_FILE) || tryParse(BACKUP_FILE) || createEmptyStore();
}

function writeStoreToDisk(store: StorePayload): void {
  ensureDataDir();
  const next: StorePayload = {
    ...store,
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(next, null, 2);
  const tmpFile = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, serialized, 'utf-8');
  if (fs.existsSync(STORE_FILE)) {
    try {
      fs.copyFileSync(STORE_FILE, BACKUP_FILE);
    } catch {
      // Best-effort backup copy before atomic swap
    }
  }
  fs.renameSync(tmpFile, STORE_FILE);
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withStoreLock<T>(fn: (current: StorePayload) => { next?: StorePayload; result: T }): Promise<T> {
  const run = async () => {
    const current = readStoreFromDisk();
    const { next, result } = fn(current);
    if (next) {
      writeStoreToDisk(next);
    }
    return result;
  };
  const task = writeQueue.then(run, run);
  writeQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

function mergeById(
  existingList: unknown[],
  incomingList: unknown[],
  deletedSet: Set<string>
): unknown[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of existingList) {
    if (item && typeof item === 'object' && 'id' in item) {
      const rec = item as Record<string, unknown>;
      const id = String(rec.id);
      if (!deletedSet.has(id)) {
        map.set(id, rec);
      }
    }
  }
  for (const item of incomingList) {
    if (item && typeof item === 'object' && 'id' in item) {
      const rec = item as Record<string, unknown>;
      const id = String(rec.id);
      if (deletedSet.has(id)) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, rec);
      } else {
        const prevTime = Date.parse(String(prev.updatedAt || prev.createdAt || '')) || 0;
        const nextTime = Date.parse(String(rec.updatedAt || rec.createdAt || '')) || 0;
        map.set(id, nextTime >= prevTime ? { ...prev, ...rec } : prev);
      }
    }
  }
  return Array.from(map.values());
}

async function startServer() {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    writeStoreToDisk(createEmptyStore());
  }

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const store = readStoreFromDisk();
    res.json({
      ok: true,
      dataDir: DATA_DIR,
      updatedAt: store.updatedAt,
    });
  });

  app.get('/api/storage/state', (_req: Request, res: Response) => {
    const store = readStoreFromDisk();
    res.json({ ok: true, store });
  });

  app.post('/api/storage/upsert', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        collectionName?: string;
        record?: Record<string, unknown>;
        deleteId?: string;
        staffMember?: Record<string, unknown>;
        deleteStaffId?: string;
        settings?: Record<string, unknown>;
      };

      const saved = await withStoreLock((current) => {
        const next: StorePayload = {
          ...current,
          deletedIds: { ...(current.deletedIds || {}) },
        };

        if (body.collectionName && COLLECTION_TO_STATE_KEY[body.collectionName]) {
          const stateKey = COLLECTION_TO_STATE_KEY[body.collectionName];
          const list = Array.isArray(next[stateKey]) ? [...(next[stateKey] as unknown[])] : [];
          const delList = new Set(next.deletedIds[body.collectionName] || []);

          if (body.deleteId) {
            delList.add(body.deleteId);
            next.deletedIds[body.collectionName] = Array.from(delList).slice(-500);
            (next[stateKey] as unknown[]) = list.filter(
              (item) => !(item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === body.deleteId)
            );
          } else if (body.record && body.record.id) {
            const recId = String(body.record.id);
            delList.delete(recId);
            next.deletedIds[body.collectionName] = Array.from(delList);
            const exists = list.some(
              (item) => item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === recId
            );
            (next[stateKey] as unknown[]) = exists
              ? list.map((item) =>
                  item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === recId
                    ? body.record
                    : item
                )
              : [body.record, ...list];
          }
        }

        if (body.deleteStaffId) {
          const delList = new Set(next.deletedIds.staff || []);
          delList.add(body.deleteStaffId);
          next.deletedIds.staff = Array.from(delList).slice(-200);
          next.staff = next.staff.filter(
            (item) => !(item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === body.deleteStaffId)
          );
        } else if (body.staffMember && body.staffMember.id) {
          const staffId = String(body.staffMember.id);
          const delList = new Set(next.deletedIds.staff || []);
          delList.delete(staffId);
          next.deletedIds.staff = Array.from(delList);
          const exists = next.staff.some(
            (item) => item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === staffId
          );
          next.staff = exists
            ? next.staff.map((item) =>
                item && typeof item === 'object' && 'id' in item && String((item as { id: unknown }).id) === staffId
                  ? body.staffMember
                  : item
              )
            : [...next.staff, body.staffMember];
        }

        if (body.settings && typeof body.settings === 'object') {
          next.settings = body.settings;
        }

        return { next, result: next };
      });

      res.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to persist data',
      });
    }
  });

  app.post('/api/storage/sync', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        state?: Partial<StorePayload>;
        mode?: 'merge' | 'authoritative_cloud';
      };
      const incoming = body.state || {};
      const mode = body.mode || 'merge';

      const saved = await withStoreLock((current) => {
        const next: StorePayload = {
          ...current,
          deletedIds: { ...(current.deletedIds || {}) },
        };

        for (const key of ARRAY_KEYS) {
          const incomingArr = Array.isArray(incoming[key]) ? (incoming[key] as unknown[]) : [];
          const existingArr = Array.isArray(current[key]) ? (current[key] as unknown[]) : [];
          if (incomingArr.length === 0 && mode === 'merge') {
            continue;
          }

          const collectionMatch = Object.entries(COLLECTION_TO_STATE_KEY).find(([, v]) => v === key)?.[0];
          const deletedSet = new Set(
            collectionMatch ? next.deletedIds[collectionMatch] || [] : key === 'staff' ? next.deletedIds.staff || [] : []
          );

          if (mode === 'authoritative_cloud') {
            (next[key] as unknown[]) = mergeById(existingArr, incomingArr, deletedSet);
          } else {
            (next[key] as unknown[]) = mergeById(existingArr, incomingArr, deletedSet);
          }
        }

        if (incoming.settings && typeof incoming.settings === 'object') {
          next.settings = incoming.settings;
        }

        return { next, result: next };
      });

      res.json({ ok: true, store: saved });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to sync data',
      });
    }
  });

  app.get('/api/storage/backup', (_req: Request, res: Response) => {
    const store = readStoreFromDisk();
    const dateSlug = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eoffice-backup-${dateSlug}.json"`);
    res.send(JSON.stringify(store, null, 2));
  });

  app.post('/api/storage/restore', async (req: Request, res: Response) => {
    try {
      const incoming = req.body as Partial<StorePayload>;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ ok: false, error: 'Invalid backup payload' });
        return;
      }

      const restored = await withStoreLock((current) => {
        const next: StorePayload = {
          ...current,
          deletedIds: { ...(current.deletedIds || {}) },
        };
        for (const key of ARRAY_KEYS) {
          const incomingArr = Array.isArray(incoming[key]) ? (incoming[key] as unknown[]) : [];
          const existingArr = Array.isArray(current[key]) ? (current[key] as unknown[]) : [];
          if (incomingArr.length > 0) {
            (next[key] as unknown[]) = mergeById(existingArr, incomingArr, new Set());
          }
        }
        if (incoming.settings && typeof incoming.settings === 'object') {
          next.settings = incoming.settings;
        }
        return { next, result: next };
      });

      res.json({ ok: true, store: restored });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to restore backup',
      });
    }
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV !== 'development' && fs.existsSync(path.join(distDir, 'index.html')));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port} (DATA_DIR=${DATA_DIR})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
