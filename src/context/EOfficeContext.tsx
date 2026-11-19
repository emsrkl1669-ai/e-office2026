import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  DEFAULT_APP_SETTINGS,
  ORG_ID,
  SEED_STAFF,
} from '../data/seedData';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AppSettings,
  EquipmentLoan,
  FireReliefRequest,
  InventoryItem,
  LeaveRequest,
  NotificationCategory,
  NotificationItem,
  PavilionRequest,
  RegistryDocument,
  RepairRequest,
  StaffMember,
  UserRole,
  Vehicle,
  VehicleInspection,
} from '../types/eoffice';
import { sha256Hex } from '../utils/crypto';
import { PrintPreviewModal } from '../components/PrintPreviewModal';

const LEGACY_CACHE_KEY = 'rk_eoffice_state_v1';
const CACHE_KEY = 'rk_eoffice_state_v2';
const SAMPLE_PURGED_KEY = 'rk_sample_purged_v2';

const LEGACY_SAMPLE_RECORD_IDS: Record<string, string[]> = {
  incoming_docs: ['inc_001', 'inc_002'],
  outgoing_docs: ['out_001'],
  leave_requests: ['leave_001', 'leave_002'],
  medical_items: ['med_001', 'med_002', 'med_003', 'med_004'],
  medical_loans: ['mloan_001'],
  kitchen_items: ['kit_001', 'kit_002', 'kit_003'],
  kitchen_loans: ['kloan_001'],
  vehicles: ['veh_400', 'veh_401', 'veh_402', 'veh_403', 'veh_404', 'veh_405'],
  repairs: ['rep_001', 'rep_002'],
  pavilion_requests: ['pav_001'],
  notifications: ['notif_init_1'],
};

interface CachedState {
  staff: StaffMember[];
  incomingDocs: RegistryDocument[];
  outgoingDocs: RegistryDocument[];
  leaveRequests: LeaveRequest[];
  medicalItems: InventoryItem[];
  medicalLoans: EquipmentLoan[];
  kitchenItems: InventoryItem[];
  kitchenLoans: EquipmentLoan[];
  vehicles: Vehicle[];
  vehicleInspections: VehicleInspection[];
  repairs: RepairRequest[];
  pavilionRequests: PavilionRequest[];
  fireReliefRequests: FireReliefRequest[];
  notifications: NotificationItem[];
  settings: AppSettings;
}

function getDefaultCache(): CachedState {
  return {
    staff: SEED_STAFF,
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
    settings: DEFAULT_APP_SETTINGS,
  };
}

function filterOutSampleIds<T extends { id: string }>(items: unknown, sampleIds: string[]): T[] {
  if (!Array.isArray(items)) return [];
  const sampleSet = new Set(sampleIds);
  return items.filter((item): item is T => Boolean(item && typeof item === 'object' && 'id' in item && !sampleSet.has((item as { id: string }).id)));
}

function loadLocalCache(): CachedState {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultCache(), ...parsed };
    }
    const legacyRaw = localStorage.getItem(LEGACY_CACHE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      const cleaned: CachedState = {
        ...getDefaultCache(),
        staff: Array.isArray(parsed.staff) && parsed.staff.length > 0 ? parsed.staff : SEED_STAFF,
        incomingDocs: filterOutSampleIds<RegistryDocument>(parsed.incomingDocs, LEGACY_SAMPLE_RECORD_IDS.incoming_docs),
        outgoingDocs: filterOutSampleIds<RegistryDocument>(parsed.outgoingDocs, LEGACY_SAMPLE_RECORD_IDS.outgoing_docs),
        leaveRequests: filterOutSampleIds<LeaveRequest>(parsed.leaveRequests, LEGACY_SAMPLE_RECORD_IDS.leave_requests),
        medicalItems: filterOutSampleIds<InventoryItem>(parsed.medicalItems, LEGACY_SAMPLE_RECORD_IDS.medical_items),
        medicalLoans: filterOutSampleIds<EquipmentLoan>(parsed.medicalLoans, LEGACY_SAMPLE_RECORD_IDS.medical_loans),
        kitchenItems: filterOutSampleIds<InventoryItem>(parsed.kitchenItems, LEGACY_SAMPLE_RECORD_IDS.kitchen_items),
        kitchenLoans: filterOutSampleIds<EquipmentLoan>(parsed.kitchenLoans, LEGACY_SAMPLE_RECORD_IDS.kitchen_loans),
        vehicles: filterOutSampleIds<Vehicle>(parsed.vehicles, LEGACY_SAMPLE_RECORD_IDS.vehicles),
        vehicleInspections: Array.isArray(parsed.vehicleInspections) ? parsed.vehicleInspections : [],
        repairs: filterOutSampleIds<RepairRequest>(parsed.repairs, LEGACY_SAMPLE_RECORD_IDS.repairs),
        pavilionRequests: filterOutSampleIds<PavilionRequest>(parsed.pavilionRequests, LEGACY_SAMPLE_RECORD_IDS.pavilion_requests),
        notifications: filterOutSampleIds<NotificationItem>(parsed.notifications, LEGACY_SAMPLE_RECORD_IDS.notifications),
        settings: parsed.settings || DEFAULT_APP_SETTINGS,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cleaned));
      localStorage.removeItem(LEGACY_CACHE_KEY);
      return cleaned;
    }
    return getDefaultCache();
  } catch {
    return getDefaultCache();
  }
}

function saveLocalCache(state: CachedState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.06, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.26);
    });
  } catch {
    // Audio playback blocked before interaction
  }
}

export interface EOfficeContextValue extends CachedState {
  firebaseUser: User | null;
  authReady: boolean;
  isCloudSynced: boolean;
  isOnline: boolean;
  currentStaff: StaffMember | null;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  loginWithCredentials: (identifier: string, pin: string, mode: 'code' | 'email') => Promise<{ ok: boolean; error?: string }>;
  switchDutyStaff: (staffId: string, pin?: string) => Promise<{ ok: boolean; error?: string }>;
  changeOwnPin: (oldPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  pushNotification: (title: string, message: string, category: NotificationCategory) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveRecord: <T extends { id: string }>(collectionName: string, record: T, isNew: boolean) => Promise<void>;
  removeRecord: (collectionName: string, id: string) => Promise<void>;
  saveStaffMember: (member: StaffMember, isNew: boolean) => Promise<void>;
  deleteStaffMember: (staffId: string) => Promise<void>;
  updateAppSettings: (next: AppSettings) => Promise<void>;
  openPrintPreview: (title: string, fileName: string, htmlContent: string) => void;
  canApproveTier1: boolean;
  canApproveTier2: boolean;
  canManageRegistry: boolean;
  canDeleteRegistry: boolean;
  canManageUsers: boolean;
}

const EOfficeContext = createContext<EOfficeContextValue | null>(null);

export const EOfficeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<CachedState>(() => loadLocalCache());
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('rk_active_staff_id');
    } catch {
      return null;
    }
  });
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rk_notif_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const [printModal, setPrintModal] = useState<{
    open: boolean;
    title: string;
    fileName: string;
    htmlContent: string;
  }>({ open: false, title: '', fileName: 'document', htmlContent: '' });

  const prevNotifCountRef = useRef<number>(cache.notifications.length);
  const seededCloudRef = useRef(false);

  const updateCache = useCallback((updater: (prev: CachedState) => CachedState) => {
    setCache((prev) => {
      const next = updater(prev);
      saveLocalCache(next);
      return next;
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem('rk_notif_sound', String(enabled));
    } catch {
      // ignore
    }
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user?.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL) {
        setCurrentStaffId('staff_01');
        try {
          localStorage.setItem('rk_active_staff_id', 'staff_01');
        } catch {
          // ignore
        }
      }
    });
    return () => unsub();
  }, []);

  const isCloudSynced = Boolean(firebaseUser && firebaseUser.emailVerified);

  // Seed core roles, settings & real staff directory when Admin signs in for the first time,
  // and purge any previously-seeded sample operational records from Firestore.
  const seedFirestoreIfEmpty = useCallback(async (user: User) => {
    if (seededCloudRef.current) return;
    if (user.email?.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL) return;
    seededCloudRef.current = true;

    try {
      const staffSnap = await getDocs(
        query(collection(db, 'staff_directory'), where('orgId', '==', ORG_ID))
      );
      if (staffSnap.empty) {
        // Seed Role for Admin
        await setDoc(doc(db, 'roles', user.uid), {
          uid: user.uid,
          email: user.email,
          role: 'Admin',
          staffId: 'staff_01',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Seed App Settings
        await setDoc(doc(db, 'app_settings', DEFAULT_APP_SETTINGS.id), {
          ...DEFAULT_APP_SETTINGS,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });

        // Seed Staff Directory + Staff Private
        for (const s of SEED_STAFF) {
          await setDoc(doc(db, 'staff_directory', s.id), {
            id: s.id,
            orgId: ORG_ID,
            employeeCode: s.employeeCode,
            fullName: s.fullName,
            department: s.department,
            position: s.position,
            startDate: s.startDate,
            role: s.role,
            status: s.status,
            ...(s.id === 'staff_01' ? { authUid: user.uid } : {}),
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await setDoc(doc(db, 'staff_private', s.id), {
            staffId: s.id,
            ...(s.id === 'staff_01' ? { authUid: user.uid } : {}),
            email: s.email,
            phone: s.phone,
            pinHash: s.pinHash,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // One-time cleanup of legacy sample records in Firestore if previously seeded
      let alreadyPurged = false;
      try {
        alreadyPurged = localStorage.getItem(SAMPLE_PURGED_KEY) === 'true';
      } catch {
        alreadyPurged = false;
      }
      if (!alreadyPurged) {
        const deletes: Promise<void>[] = [];
        for (const [colName, ids] of Object.entries(LEGACY_SAMPLE_RECORD_IDS)) {
          for (const docId of ids) {
            deletes.push(deleteDoc(doc(db, colName, docId)).catch(() => undefined));
          }
        }
        await Promise.all(deletes);
        try {
          localStorage.setItem(SAMPLE_PURGED_KEY, 'true');
        } catch {
          // ignore
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed_initial_data');
    }
  }, []);

  // Attach Real-Time Firestore listeners ONLY when verified user is signed in
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    seedFirestoreIfEmpty(firebaseUser);

    const orgWhere = where('orgId', '==', ORG_ID);
    const unsubs: (() => void)[] = [];

    // Staff directory + private merge
    let latestDir: Partial<StaffMember>[] = [];
    let latestPrivate: Record<string, { email?: string; phone?: string; pinHash?: string; authUid?: string }> = {};

    const mergeStaff = () => {
      if (latestDir.length === 0) return;
      updateCache((prev) => {
        const merged: StaffMember[] = latestDir.map((d) => {
          const priv = latestPrivate[d.id!] || {};
          const existing = prev.staff.find((s) => s.id === d.id);
          return {
            ...(d as StaffMember),
            email: priv.email ?? existing?.email ?? '',
            phone: priv.phone ?? existing?.phone ?? '',
            pinHash: priv.pinHash ?? existing?.pinHash ?? '',
            authUid: priv.authUid ?? d.authUid ?? existing?.authUid,
          };
        });
        return { ...prev, staff: merged };
      });
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'staff_directory'), orgWhere),
        (snap) => {
          latestDir = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              ...d,
              id: docSnap.id,
              createdAt: normalizeTimestamp(d.createdAt),
              updatedAt: normalizeTimestamp(d.updatedAt),
            } as Partial<StaffMember>;
          });
          mergeStaff();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staff_directory')
      )
    );

    const isBootstrapAdminUser = firebaseUser.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;
    const privQuery = isBootstrapAdminUser
      ? collection(db, 'staff_private')
      : query(collection(db, 'staff_private'), where('authUid', '==', firebaseUser.uid));

    unsubs.push(
      onSnapshot(
        privQuery,
        (snap) => {
          const map: typeof latestPrivate = {};
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            map[docSnap.id] = {
              email: d.email,
              phone: d.phone,
              pinHash: d.pinHash,
              authUid: d.authUid,
            };
          });
          latestPrivate = map;
          mergeStaff();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staff_private')
      )
    );

    const subscribeCol = <K extends keyof CachedState>(
      colName: string,
      stateKey: K
    ) => {
      unsubs.push(
        onSnapshot(
          query(collection(db, colName), orgWhere),
          (snap) => {
            const items = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                ...d,
                id: docSnap.id,
                createdAt: normalizeTimestamp(d.createdAt),
                ...(d.updatedAt ? { updatedAt: normalizeTimestamp(d.updatedAt) } : {}),
              };
            });
            updateCache((prev) => ({ ...prev, [stateKey]: items }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, colName)
        )
      );
    };

    subscribeCol('incoming_docs', 'incomingDocs');
    subscribeCol('outgoing_docs', 'outgoingDocs');
    subscribeCol('leave_requests', 'leaveRequests');
    subscribeCol('medical_items', 'medicalItems');
    subscribeCol('medical_loans', 'medicalLoans');
    subscribeCol('kitchen_items', 'kitchenItems');
    subscribeCol('kitchen_loans', 'kitchenLoans');
    subscribeCol('vehicles', 'vehicles');
    subscribeCol('vehicle_inspections', 'vehicleInspections');
    subscribeCol('repairs', 'repairs');
    subscribeCol('pavilion_requests', 'pavilionRequests');
    subscribeCol('fire_relief_requests', 'fireReliefRequests');
    subscribeCol('notifications', 'notifications');

    unsubs.push(
      onSnapshot(
        query(collection(db, 'app_settings'), orgWhere),
        (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data();
            updateCache((prev) => ({
              ...prev,
              settings: {
                ...DEFAULT_APP_SETTINGS,
                ...d,
                id: snap.docs[0].id,
                updatedAt: normalizeTimestamp(d.updatedAt),
              },
            }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'app_settings')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, seedFirestoreIfEmpty, updateCache]);

  // Trigger notification sound when new notification arrives
  useEffect(() => {
    if (cache.notifications.length > prevNotifCountRef.current && soundEnabled) {
      playNotificationChime();
    }
    prevNotifCountRef.current = cache.notifications.length;
  }, [cache.notifications.length, soundEnabled]);

  const currentStaff = cache.staff.find((s) => s.id === currentStaffId) || null;

  const loginWithGoogle = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email?.toLowerCase() || '';
      const matched =
        email === ADMIN_BOOTSTRAP_EMAIL
          ? cache.staff.find((s) => s.id === 'staff_01') || cache.staff[0]
          : cache.staff.find((s) => s.email.toLowerCase() === email);

      if (matched) {
        if (matched.status === 'Inactive') {
          await signOut(auth);
          return { ok: false, error: 'บัญชีผู้ใช้งานนี้ถูกระงับสิทธิ์ชั่วคราว กรุณาติดต่อ Admin' };
        }
        setCurrentStaffId(matched.id);
        localStorage.setItem('rk_active_staff_id', matched.id);
      } else {
        // Fallback to Staff profile for verified Google Workspace account not yet in directory
        const guestStaff: StaffMember = {
          id: `staff_g_${result.user.uid.slice(0, 8)}`,
          orgId: ORG_ID,
          employeeCode: 'GW-USER',
          fullName: result.user.displayName || email,
          email,
          phone: '-',
          department: 'Google Workspace',
          position: 'ผู้ใช้งานภายนอก/สมาชิกใหม่',
          startDate: new Date().toISOString().slice(0, 10),
          role: 'Staff',
          status: 'Active',
          pinHash: '',
          authUid: result.user.uid,
          createdBy: result.user.uid,
        };
        updateCache((prev) => ({
          ...prev,
          staff: prev.staff.some((s) => s.id === guestStaff.id)
            ? prev.staff
            : [...prev.staff, guestStaff],
        }));
        setCurrentStaffId(guestStaff.id);
        localStorage.setItem('rk_active_staff_id', guestStaff.id);
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วย Google Workspace ได้';
      return { ok: false, error: msg };
    }
  };

  const loginWithCredentials = async (
    identifier: string,
    pin: string,
    mode: 'code' | 'email'
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanId = identifier.trim().toLowerCase();
    const matched = cache.staff.find((s) =>
      mode === 'code'
        ? s.employeeCode.toLowerCase() === cleanId
        : s.email.toLowerCase() === cleanId
    );
    if (!matched) {
      return { ok: false, error: mode === 'code' ? 'ไม่พบรหัสพนักงานในระบบ' : 'ไม่พบอีเมลนี้ในระบบ' };
    }
    if (matched.status === 'Inactive') {
      return { ok: false, error: 'บัญชีนี้ถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
    }
    const enteredHash = await sha256Hex(pin.trim());
    if (enteredHash !== matched.pinHash) {
      return { ok: false, error: 'รหัส PIN ไม่ถูกต้อง (ค่าเริ่มต้นระบบคือ 123456)' };
    }
    setCurrentStaffId(matched.id);
    localStorage.setItem('rk_active_staff_id', matched.id);
    return { ok: true };
  };

  const switchDutyStaff = async (staffId: string, pin?: string): Promise<{ ok: boolean; error?: string }> => {
    const target = cache.staff.find((s) => s.id === staffId);
    if (!target) return { ok: false, error: 'ไม่พบข้อมูลบุคลากร' };
    if (target.status === 'Inactive') return { ok: false, error: 'บุคลากรนี้สถานะ Inactive' };
    if (currentStaff?.role !== 'Admin' && pin !== undefined) {
      const hash = await sha256Hex(pin.trim());
      if (hash !== target.pinHash) return { ok: false, error: 'รหัส PIN สำหรับสลับเวรไม่ถูกต้อง' };
    }
    setCurrentStaffId(target.id);
    localStorage.setItem('rk_active_staff_id', target.id);
    return { ok: true };
  };

  const changeOwnPin = async (oldPin: string, newPin: string): Promise<{ ok: boolean; error?: string }> => {
    if (!currentStaff) return { ok: false, error: 'ไม่พบผู้ใช้งานปัจจุบัน' };
    if (newPin.trim().length < 4) return { ok: false, error: 'รหัส PIN ใหม่ต้องมีอย่างน้อย 4 หลัก' };
    const oldHash = await sha256Hex(oldPin.trim());
    if (oldHash !== currentStaff.pinHash) {
      return { ok: false, error: 'รหัส PIN เดิมไม่ถูกต้อง' };
    }
    const newHash = await sha256Hex(newPin.trim());
    const updated: StaffMember = { ...currentStaff, pinHash: newHash };
    await saveStaffMember(updated, false);
    return { ok: true };
  };

  const logout = async () => {
    setCurrentStaffId(null);
    localStorage.removeItem('rk_active_staff_id');
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const mapStateKey = (colName: string): keyof CachedState | null => {
    const map: Record<string, keyof CachedState> = {
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
    return map[colName] || null;
  };

  const saveRecord = async <T extends { id: string }>(
    collectionName: string,
    record: T,
    isNew: boolean
  ) => {
    const stateKey = mapStateKey(collectionName);
    const nowIso = new Date().toISOString();
    const hasUpdatedAt =
      collectionName !== 'vehicle_inspections' && collectionName !== 'notifications';

    const localRecord = {
      ...record,
      orgId: ORG_ID,
      createdBy:
        isNew
          ? firebaseUser?.uid || currentStaff?.id || 'local'
          : (record as unknown as { createdBy?: string }).createdBy || 'local',
      createdAt:
        isNew
          ? nowIso
          : (record as unknown as { createdAt?: string }).createdAt || nowIso,
      ...(hasUpdatedAt ? { updatedAt: nowIso } : {}),
    };

    if (stateKey) {
      updateCache((prev) => {
        const list = prev[stateKey] as unknown as Array<{ id: string }>;
        const exists = list.some((item) => item.id === record.id);
        const nextList = exists
          ? list.map((item) => (item.id === record.id ? localRecord : item))
          : [localRecord, ...list];
        return { ...prev, [stateKey]: nextList };
      });
    }

    if (isCloudSynced && firebaseUser) {
      try {
        const ref = doc(db, collectionName, record.id);
        // Strip undefined fields for Firestore strict validation
        const cleanPayload: Record<string, unknown> = {};
        Object.entries(localRecord).forEach(([k, v]) => {
          if (v !== undefined) cleanPayload[k] = v;
        });
        if (isNew) {
          cleanPayload.createdBy = firebaseUser.uid;
          cleanPayload.createdAt = serverTimestamp();
          if (hasUpdatedAt) cleanPayload.updatedAt = serverTimestamp();
          await setDoc(ref, cleanPayload);
        } else {
          // Preserve immutable fields, only pass serverTimestamp for updatedAt
          delete cleanPayload.createdAt;
          delete cleanPayload.createdBy;
          delete cleanPayload.orgId;
          delete cleanPayload.id;
          if (hasUpdatedAt) cleanPayload.updatedAt = serverTimestamp();
          await updateDoc(ref, cleanPayload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `${collectionName}/${record.id}`);
      }
    }
  };

  const removeRecord = async (collectionName: string, id: string) => {
    const stateKey = mapStateKey(collectionName);
    if (stateKey) {
      updateCache((prev) => {
        const list = prev[stateKey] as unknown as Array<{ id: string }>;
        return { ...prev, [stateKey]: list.filter((i) => i.id !== id) };
      });
    }

    if (isCloudSynced) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      }
    }
  };

  const saveStaffMember = async (member: StaffMember, isNew: boolean) => {
    const nowIso = new Date().toISOString();
    const nextMember = {
      ...member,
      orgId: ORG_ID,
      updatedAt: nowIso,
      createdAt: isNew ? nowIso : member.createdAt || nowIso,
    };
    updateCache((prev) => {
      const exists = prev.staff.some((s) => s.id === member.id);
      return {
        ...prev,
        staff: exists
          ? prev.staff.map((s) => (s.id === member.id ? nextMember : s))
          : [...prev.staff, nextMember],
      };
    });

    if (isCloudSynced && firebaseUser) {
      try {
        const dirPayload: Record<string, unknown> = {
          id: member.id,
          orgId: ORG_ID,
          employeeCode: member.employeeCode,
          fullName: member.fullName,
          department: member.department,
          position: member.position,
          startDate: member.startDate,
          role: member.role,
          status: member.status,
          ...(member.authUid ? { authUid: member.authUid } : {}),
          ...(member.signatureDataUrl ? { signatureDataUrl: member.signatureDataUrl } : {}),
          updatedAt: serverTimestamp(),
        };
        const privPayload: Record<string, unknown> = {
          staffId: member.id,
          ...(member.authUid ? { authUid: member.authUid } : {}),
          email: member.email,
          phone: member.phone,
          pinHash: member.pinHash,
          updatedAt: serverTimestamp(),
        };

        if (isNew) {
          dirPayload.createdBy = firebaseUser.uid;
          dirPayload.createdAt = serverTimestamp();
          await setDoc(doc(db, 'staff_directory', member.id), dirPayload);
          await setDoc(doc(db, 'staff_private', member.id), privPayload);
        } else {
          await updateDoc(doc(db, 'staff_directory', member.id), dirPayload);
          await updateDoc(doc(db, 'staff_private', member.id), privPayload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `staff_directory/${member.id}`);
      }
    }
  };

  const deleteStaffMember = async (staffId: string) => {
    updateCache((prev) => ({
      ...prev,
      staff: prev.staff.filter((s) => s.id !== staffId),
    }));
    if (isCloudSynced) {
      try {
        await deleteDoc(doc(db, 'staff_directory', staffId));
        await deleteDoc(doc(db, 'staff_private', staffId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staff_directory/${staffId}`);
      }
    }
  };

  const updateAppSettings = async (next: AppSettings) => {
    const updated: AppSettings = {
      ...next,
      orgId: ORG_ID,
      updatedBy: firebaseUser?.uid || currentStaff?.id || 'admin',
      updatedAt: new Date().toISOString(),
    };
    updateCache((prev) => ({ ...prev, settings: updated }));
    if (isCloudSynced && firebaseUser) {
      try {
        await setDoc(doc(db, 'app_settings', updated.id), {
          ...updated,
          updatedBy: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `app_settings/${updated.id}`);
      }
    }
  };

  const pushNotification = async (
    title: string,
    message: string,
    category: NotificationCategory
  ) => {
    const notif: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orgId: ORG_ID,
      title,
      message,
      category,
      readBy: [],
      createdBy: firebaseUser?.uid || currentStaff?.id || 'system',
      createdAt: new Date().toISOString(),
    };
    await saveRecord('notifications', notif, true);
  };

  const markAllNotificationsRead = async () => {
    const readerId = currentStaff?.id || firebaseUser?.uid || 'user';
    const unread = cache.notifications.filter((n) => !n.readBy?.includes(readerId));
    for (const item of unread) {
      const nextRead = [...(item.readBy || []), readerId];
      await saveRecord('notifications', { ...item, readBy: nextRead }, false);
    }
  };

  const openPrintPreview = (title: string, fileName: string, htmlContent: string) => {
    setPrintModal({ open: true, title, fileName, htmlContent });
  };

  const activeRole: UserRole = currentStaff?.role || 'Staff';
  const canApproveTier1 = activeRole === 'Admin' || activeRole === 'Manager' || activeRole === 'Supervisor';
  const canApproveTier2 = activeRole === 'Admin' || activeRole === 'Manager';
  const canManageRegistry =
    activeRole === 'Admin' || activeRole === 'Manager' || activeRole === 'Registrar';
  const canDeleteRegistry =
    activeRole === 'Admin' || activeRole === 'Manager' || activeRole === 'Registrar';
  const canManageUsers = activeRole === 'Admin';

  return (
    <EOfficeContext.Provider
      value={{
        ...cache,
        firebaseUser,
        authReady,
        isCloudSynced,
        isOnline,
        currentStaff,
        soundEnabled,
        setSoundEnabled,
        loginWithGoogle,
        loginWithCredentials,
        switchDutyStaff,
        changeOwnPin,
        logout,
        pushNotification,
        markAllNotificationsRead,
        saveRecord,
        removeRecord,
        saveStaffMember,
        deleteStaffMember,
        updateAppSettings,
        openPrintPreview,
        canApproveTier1,
        canApproveTier2,
        canManageRegistry,
        canDeleteRegistry,
        canManageUsers,
      }}
    >
      {children}
      <PrintPreviewModal
        open={printModal.open}
        title={printModal.title}
        fileName={printModal.fileName}
        htmlContent={printModal.htmlContent}
        onClose={() => setPrintModal((p) => ({ ...p, open: false }))}
      />
    </EOfficeContext.Provider>
  );
};

export function useEOffice(): EOfficeContextValue {
  const ctx = useContext(EOfficeContext);
  if (!ctx) throw new Error('useEOffice must be used within EOfficeProvider');
  return ctx;
}
