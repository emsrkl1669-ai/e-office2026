import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FlameKindling,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import {
  DEFAULT_FIRE_RELIEF_ATTACHMENTS,
  FIRE_RELIEF_DAMAGED_NOTES,
  FIRE_RELIEF_DECEASED_NOTES,
  FOUNDATION_LOGO_PATH,
  FOUNDATION_NAME,
  ORG_ID,
} from '../data/seedData';
import {
  ElectronicSignature,
  FireReliefAttachment,
  FireReliefRequest,
  FireReliefVictim,
} from '../types/eoffice';
import { escapeHtml, exportToGoogleDocsFile } from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

const DAMAGE_LABELS: Record<FireReliefVictim['damageType'], string> = {
  full: 'เสียหายทั้งหลัง',
  partial: 'เสียหายบางส่วน',
  deceased: 'เสียชีวิต',
  other: 'อื่นๆ',
};

function formatCurrency(val: number): string {
  return Number(val || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const THAI_WEEKDAYS = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function parseIsoDateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function daysInMonth(yearAd: number, month1To12: number): number {
  return new Date(yearAd, month1To12, 0).getDate();
}

function formatLongThaiDate(dateStr?: string): string {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return dateStr || '....................................';
  const d = new Date(parts.year, parts.month - 1, parts.day);
  const weekday = THAI_WEEKDAYS[d.getDay()];
  const monthName = THAI_MONTHS[parts.month - 1];
  const beYear = parts.year + 543;
  return `${weekday} ที่ ${parts.day} เดือน${monthName} พ.ศ. ${beYear}`;
}

function formatShortLongThaiDate(dateStr?: string): string {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return dateStr || '................................';
  const monthName = THAI_MONTHS[parts.month - 1];
  const beYear = parts.year + 543;
  return `${parts.day} ${monthName} พ.ศ. ${beYear}`;
}

interface ThaiBeDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  labelPrefix: string;
}

const ThaiBeDateInput: React.FC<ThaiBeDateInputProps> = ({
  value,
  onChange,
  required,
  labelPrefix,
}) => {
  const now = new Date();
  const parsed = parseIsoDateParts(value);
  const currentAdYear = parsed?.year ?? now.getFullYear();
  const currentMonth = parsed?.month ?? now.getMonth() + 1;
  const currentDay = parsed?.day ?? now.getDate();
  const currentBeYear = currentAdYear + 543;

  const baseBeYear = now.getFullYear() + 543;
  const minBeYear = Math.min(baseBeYear - 10, currentBeYear);
  const maxBeYear = Math.max(baseBeYear + 5, currentBeYear);
  const beYears: number[] = [];
  for (let y = maxBeYear; y >= minBeYear; y -= 1) {
    beYears.push(y);
  }

  const maxDay = daysInMonth(currentAdYear, currentMonth);
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  const emitDate = (nextDay: number, nextMonth: number, nextBeYear: number) => {
    const nextAdYear = nextBeYear - 543;
    const clampedDay = Math.min(nextDay, daysInMonth(nextAdYear, nextMonth));
    const iso = `${String(nextAdYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    onChange(iso);
  };

  return (
    <div className="grid grid-cols-12 gap-1.5">
      <select
        aria-label={`${labelPrefix} - วัน`}
        required={required}
        value={parsed ? currentDay : ''}
        onChange={(e) => emitDate(Number(e.target.value), currentMonth, currentBeYear)}
        className="col-span-3 h-10 px-1.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
      >
        {!parsed && <option value="">วัน</option>}
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label={`${labelPrefix} - เดือน`}
        required={required}
        value={parsed ? currentMonth : ''}
        onChange={(e) => emitDate(currentDay, Number(e.target.value), currentBeYear)}
        className="col-span-5 h-10 px-1.5 text-sm bg-white border border-slate-300 rounded-lg"
      >
        {!parsed && <option value="">เดือน</option>}
        {THAI_MONTHS.map((m, idx) => (
          <option key={m} value={idx + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${labelPrefix} - พ.ศ.`}
        required={required}
        value={parsed ? currentBeYear : ''}
        onChange={(e) => emitDate(currentDay, currentMonth, Number(e.target.value))}
        className="col-span-4 h-10 px-1.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
      >
        {!parsed && <option value="">พ.ศ.</option>}
        {beYears.map((y) => (
          <option key={y} value={y}>
            พ.ศ. {y}
          </option>
        ))}
      </select>
    </div>
  );
};

function createEmptyVictim(rowNo: number): FireReliefVictim {
  return {
    rowNo,
    houseNumber: '',
    fullName: '',
    damageType: 'partial',
    maleCount: 0,
    femaleCount: 0,
    boyCount: 0,
    girlCount: 0,
    totalCount: 0,
    assistanceDetail: '',
    receiverName: '',
  };
}

export const FireReliefModule: React.FC = () => {
  const {
    fireReliefRequests,
    currentStaff,
    canManageRegistry,
    canApproveTier2,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FireReliefRequest['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<FireReliefRequest | null>(null);

  // Incident Header Fields
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [certifiedDate, setCertifiedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recorderName, setRecorderName] = useState('');

  // Victim Rows
  const [victims, setVictims] = useState<FireReliefVictim[]>([createEmptyVictim(1)]);

  // Financial & Supply Breakdown (แบบ อค.02)
  const [fullDamageCases, setFullDamageCases] = useState(0);
  const [fullDamageRate, setFullDamageRate] = useState(1500);
  const [partialDamageCases, setPartialDamageCases] = useState(0);
  const [partialDamageRate, setPartialDamageRate] = useState(1500);
  const [deceasedCases, setDeceasedCases] = useState(0);
  const [deceasedRate, setDeceasedRate] = useState(5000);

  const [riceBagsPerCase, setRiceBagsPerCase] = useState(2);
  const [riceBagTotal, setRiceBagTotal] = useState(0);
  const [riceBagPrice, setRiceBagPrice] = useState(100);

  const [waterPacksPerCase, setWaterPacksPerCase] = useState(2);
  const [waterPackTotal, setWaterPackTotal] = useState(0);
  const [waterPackPrice, setWaterPackPrice] = useState(80);

  const [blanketsPerCase, setBlanketsPerCase] = useState(1);
  const [blanketTotal, setBlanketTotal] = useState(0);
  const [blanketPrice, setBlanketPrice] = useState(200);

  const [extraReliefNote, setExtraReliefNote] = useState('');
  const [extraReliefValue, setExtraReliefValue] = useState(0);

  // Attachments & Notes
  const [attachments, setAttachments] = useState<FireReliefAttachment[]>(
    DEFAULT_FIRE_RELIEF_ATTACHMENTS.map((a) => ({ ...a }))
  );
  const [notes, setNotes] = useState('');

  // Manager Approval Signature Prompt
  const [sigPromptReq, setSigPromptReq] = useState<FireReliefRequest | null>(null);

  // Computed summary values
  const victimTotals = useMemo(() => {
    return victims.reduce(
      (acc, v) => ({
        male: acc.male + Number(v.maleCount || 0),
        female: acc.female + Number(v.femaleCount || 0),
        boy: acc.boy + Number(v.boyCount || 0),
        girl: acc.girl + Number(v.girlCount || 0),
        total: acc.total + Number(v.totalCount || 0),
      }),
      { male: 0, female: 0, boy: 0, girl: 0, total: 0 }
    );
  }, [victims]);

  const fullDamageAmount = Number(fullDamageCases || 0) * Number(fullDamageRate || 0);
  const partialDamageAmount = Number(partialDamageCases || 0) * Number(partialDamageRate || 0);
  const deceasedAmount = Number(deceasedCases || 0) * Number(deceasedRate || 0);
  const riceAmount = Number(riceBagTotal || 0) * Number(riceBagPrice || 0);
  const waterAmount = Number(waterPackTotal || 0) * Number(waterPackPrice || 0);
  const blanketAmount = Number(blanketTotal || 0) * Number(blanketPrice || 0);
  const extraAmount = Number(extraReliefValue || 0);

  const cashDisbursed = fullDamageAmount + partialDamageAmount + deceasedAmount;
  const totalValue = cashDisbursed + riceAmount + waterAmount + blanketAmount + extraAmount;

  const activeVictimRows = useMemo(
    () =>
      victims.filter(
        (v) =>
          v.fullName.trim() ||
          v.houseNumber.trim() ||
          v.assistanceDetail.trim() ||
          Number(v.totalCount || 0) > 0
      ),
    [victims]
  );

  const validationWarnings = useMemo(() => {
    const warnings: Array<{ kind: 'supply' | 'house' | 'date'; message: string }> = [];
    const activeCount = activeVictimRows.length;

    // 1. ตรวจสอบการคำนวณจำนวนสิ่งของรวมเทียบกับจำนวนราย
    if (activeCount > 0) {
      const expectedRice = activeCount * Number(riceBagsPerCase || 0);
      const expectedWater = activeCount * Number(waterPacksPerCase || 0);
      const expectedBlanket = activeCount * Number(blanketsPerCase || 0);
      const mismatchItems: string[] = [];
      if (Number(riceBagsPerCase || 0) > 0 && Number(riceBagTotal || 0) !== expectedRice) {
        mismatchItems.push(`ข้าวสาร (${riceBagTotal} vs ${expectedRice} ถุง)`);
      }
      if (Number(waterPacksPerCase || 0) > 0 && Number(waterPackTotal || 0) !== expectedWater) {
        mismatchItems.push(`น้ำดื่ม (${waterPackTotal} vs ${expectedWater} แพ็ค)`);
      }
      if (Number(blanketsPerCase || 0) > 0 && Number(blanketTotal || 0) !== expectedBlanket) {
        mismatchItems.push(`ผ้าห่ม (${blanketTotal} vs ${expectedBlanket} ผืน)`);
      }
      if (mismatchItems.length > 0) {
        warnings.push({
          kind: 'supply',
          message: `จำนวนสิ่งของรวมยังไม่ตรงกับยอด ${activeCount} ราย: ${mismatchItems.join(', ')}`,
        });
      }
    }

    // 2. ตรวจสอบบ้านเลขที่ที่อาจพิมพ์สลับเลขหรือต่างจากสถานที่เกิดเหตุ/รายอื่น
    const houseCounts = new Map<string, number>();
    activeVictimRows.forEach((v) => {
      const h = v.houseNumber.trim();
      if (h) houseCounts.set(h, (houseCounts.get(h) || 0) + 1);
    });
    if (houseCounts.size > 1) {
      const sortedHouses = [...houseCounts.entries()].sort((a, b) => b[1] - a[1]);
      const primaryHouse = sortedHouses[0]?.[0];
      const oddHouses = sortedHouses.slice(1).map(([h]) => h);
      if (primaryHouse && oddHouses.length > 0) {
        warnings.push({
          kind: 'house',
          message: `พบบ้านเลขที่ต่างจากรายการส่วนใหญ่ (${primaryHouse}): ${oddHouses.join(', ')} กรุณาตรวจสอบว่าเป็นการพิมพ์สลับตัวเลขหรือไม่`,
        });
      }
    }

    // 3. ตรวจสอบวันที่ลงนามรับรองเทียบกับวันที่เกิดเหตุ
    if (certifiedDate && incidentDate) {
      if (certifiedDate < incidentDate) {
        warnings.push({
          kind: 'date',
          message: `ลงวันที่รับรอง (${formatShortLongThaiDate(certifiedDate)}) อยู่ก่อนวันที่เกิดเหตุ (${formatShortLongThaiDate(incidentDate)})`,
        });
      } else {
        const diffDays = Math.round(
          (new Date(certifiedDate).getTime() - new Date(incidentDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays > 14) {
          warnings.push({
            kind: 'date',
            message: `ลงวันที่รับรอง (${formatShortLongThaiDate(certifiedDate)}) ห่างจากวันเกิดเหตุ ${diffDays} วัน กรุณาตรวจสอบวันที่ก่อนพิมพ์`,
          });
        }
      }
    }

    return warnings;
  }, [
    activeVictimRows,
    riceBagsPerCase,
    riceBagTotal,
    waterPacksPerCase,
    waterPackTotal,
    blanketsPerCase,
    blanketTotal,
    certifiedDate,
    incidentDate,
  ]);

  const openCreateModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingReq(null);
    setIncidentDate(today);
    setIncidentTime('');
    setIncidentLocation('');
    setCertifiedDate(today);
    setRecorderName(currentStaff?.fullName || '');
    setVictims([createEmptyVictim(1)]);
    setFullDamageCases(0);
    setFullDamageRate(1500);
    setPartialDamageCases(0);
    setPartialDamageRate(1500);
    setDeceasedCases(0);
    setDeceasedRate(5000);
    setRiceBagsPerCase(2);
    setRiceBagTotal(0);
    setRiceBagPrice(100);
    setWaterPacksPerCase(2);
    setWaterPackTotal(0);
    setWaterPackPrice(80);
    setBlanketsPerCase(1);
    setBlanketTotal(0);
    setBlanketPrice(200);
    setExtraReliefNote('');
    setExtraReliefValue(0);
    setAttachments(DEFAULT_FIRE_RELIEF_ATTACHMENTS.map((a) => ({ ...a })));
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (req: FireReliefRequest) => {
    setEditingReq(req);
    setIncidentDate(req.incidentDate);
    setIncidentTime(req.incidentTime || '');
    setIncidentLocation(req.incidentLocation);
    setCertifiedDate(req.certifiedDate || new Date().toISOString().slice(0, 10));
    setRecorderName(req.recorderName || '');
    setVictims(
      req.victims && req.victims.length > 0
        ? req.victims.map((v, idx) => ({ ...v, rowNo: idx + 1 }))
        : [createEmptyVictim(1)]
    );
    setFullDamageCases(req.fullDamageCases || 0);
    setFullDamageRate(req.fullDamageRate ?? 1500);
    setPartialDamageCases(req.partialDamageCases || 0);
    setPartialDamageRate(req.partialDamageRate ?? 1500);
    setDeceasedCases(req.deceasedCases || 0);
    setDeceasedRate(req.deceasedRate ?? 5000);
    setRiceBagsPerCase(req.riceBagsPerCase ?? 2);
    setRiceBagTotal(req.riceBagTotal || 0);
    setRiceBagPrice(req.riceBagPrice ?? 100);
    setWaterPacksPerCase(req.waterPacksPerCase ?? 2);
    setWaterPackTotal(req.waterPackTotal || 0);
    setWaterPackPrice(req.waterPackPrice ?? 80);
    setBlanketsPerCase(req.blanketsPerCase ?? 1);
    setBlanketTotal(req.blanketTotal || 0);
    setBlanketPrice(req.blanketPrice ?? 200);
    setExtraReliefNote(req.extraReliefNote || '');
    setExtraReliefValue(req.extraReliefValue || 0);
    setAttachments(
      req.attachments && req.attachments.length > 0
        ? req.attachments.map((a) => ({ ...a }))
        : DEFAULT_FIRE_RELIEF_ATTACHMENTS.map((a) => ({ ...a }))
    );
    setNotes(req.notes || '');
    setShowModal(true);
  };

  const updateVictimField = (
    idx: number,
    field: keyof FireReliefVictim,
    value: string | number
  ) => {
    setVictims((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated: FireReliefVictim = {
          ...row,
          [field]: value,
        } as FireReliefVictim;
        updated.totalCount =
          Number(updated.maleCount || 0) +
          Number(updated.femaleCount || 0) +
          Number(updated.boyCount || 0) +
          Number(updated.girlCount || 0);
        return updated;
      })
    );
  };

  const addVictimRow = () => {
    if (victims.length >= 100) return;
    setVictims((prev) => [...prev, createEmptyVictim(prev.length + 1)]);
  };

  const removeVictimRow = (idx: number) => {
    setVictims((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, rowNo: i + 1 }));
    });
  };

  const autoSyncFromVictims = () => {
    const activeRows = victims.filter(
      (v) =>
        v.fullName.trim() ||
        v.houseNumber.trim() ||
        v.assistanceDetail.trim() ||
        Number(v.totalCount || 0) > 0
    );
    const fullCount = activeRows.filter((v) => v.damageType === 'full').length;
    const partialCount = activeRows.filter((v) => v.damageType === 'partial').length;
    const deadCount = activeRows.filter((v) => v.damageType === 'deceased').length;
    const totalCases = activeRows.length;

    setFullDamageCases(fullCount);
    setPartialDamageCases(partialCount);
    setDeceasedCases(deadCount);
    setRiceBagTotal(totalCases * Number(riceBagsPerCase || 0));
    setWaterPackTotal(totalCases * Number(waterPacksPerCase || 0));
    setBlanketTotal(totalCases * Number(blanketsPerCase || 0));
  };

  const toggleAttachmentCheck = (key: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, verified: !a.verified } : a))
    );
  };

  const handleAttachmentFile = (key: string, file?: File) => {
    if (!file) return;
    if (file.size <= 60 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.key === key
              ? {
                  ...a,
                  verified: true,
                  fileName: file.name,
                  fileData: typeof reader.result === 'string' ? reader.result : undefined,
                }
              : a
          )
        );
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments((prev) =>
        prev.map((a) =>
          a.key === key ? { ...a, verified: true, fileName: file.name } : a
        )
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingNums = fireReliefRequests.map((r) =>
      r.docNumber.startsWith('อค.02-') ? r.docNumber.slice(6) : r.docNumber
    );
    const docNumber = editingReq
      ? editingReq.docNumber
      : `อค.02-${getNextThaiRunningNumber(existingNums)}`;

    const cleanVictims = victims
      .filter(
        (v) =>
          v.fullName.trim() ||
          v.houseNumber.trim() ||
          v.assistanceDetail.trim() ||
          v.totalCount > 0
      )
      .map((v, idx) => ({
        ...v,
        rowNo: idx + 1,
        houseNumber: v.houseNumber.trim(),
        fullName: v.fullName.trim() || `(${DAMAGE_LABELS[v.damageType]})`,
        assistanceDetail: v.assistanceDetail.trim(),
        receiverName: v.receiverName.trim(),
      }));

    const payload: FireReliefRequest = {
      id: editingReq ? editingReq.id : `fire_${Date.now()}`,
      orgId: ORG_ID,
      docNumber,
      incidentDate,
      incidentTime: incidentTime.trim() || undefined,
      incidentLocation: incidentLocation.trim(),
      certifiedDate: certifiedDate || undefined,
      victims: cleanVictims,
      fullDamageCases: Number(fullDamageCases || 0),
      fullDamageRate: Number(fullDamageRate || 0),
      partialDamageCases: Number(partialDamageCases || 0),
      partialDamageRate: Number(partialDamageRate || 0),
      deceasedCases: Number(deceasedCases || 0),
      deceasedRate: Number(deceasedRate || 0),
      riceBagsPerCase: Number(riceBagsPerCase || 0),
      riceBagTotal: Number(riceBagTotal || 0),
      riceBagPrice: Number(riceBagPrice || 0),
      waterPacksPerCase: Number(waterPacksPerCase || 0),
      waterPackTotal: Number(waterPackTotal || 0),
      waterPackPrice: Number(waterPackPrice || 0),
      blanketsPerCase: Number(blanketsPerCase || 0),
      blanketTotal: Number(blanketTotal || 0),
      blanketPrice: Number(blanketPrice || 0),
      extraReliefNote: extraReliefNote.trim() || undefined,
      extraReliefValue: Number(extraReliefValue || 0),
      totalValue,
      cashDisbursed,
      attachments,
      notes: notes.trim() || undefined,
      status: editingReq ? editingReq.status : 'pending',
      recorderName: recorderName.trim() || currentStaff?.fullName || undefined,
      approverSignature: editingReq?.approverSignature,
      createdBy: editingReq?.createdBy || currentStaff?.id || 'local',
      createdAt: editingReq?.createdAt,
    };

    await saveRecord('fire_relief_requests', payload, !editingReq);
    await pushNotification(
      editingReq
        ? `แก้ไขแบบ อค.02 (${payload.docNumber})`
        : `บันทึกการอนุเคราะห์ผู้ประสบเหตุเพลิงไหม้ ${payload.docNumber}`,
      `${payload.incidentLocation} · มูลค่ารวม ${formatCurrency(payload.totalValue)} บาท`,
      'fire_relief'
    );
    setShowModal(false);
  };

  const handleApproveWithSignature = async (
    req: FireReliefRequest,
    sig: ElectronicSignature
  ) => {
    const updated: FireReliefRequest = {
      ...req,
      status: 'approved',
      certifiedDate: req.certifiedDate || new Date().toISOString().slice(0, 10),
      approverSignature: sig,
    };
    await saveRecord('fire_relief_requests', updated, false);
    await pushNotification(
      `อนุมัติแบบ อค.02 (${req.docNumber})`,
      `ผู้จัดการมูลนิธิฯ รับรองการสงเคราะห์ผู้ประสบเหตุเพลิงไหม้ ณ ${req.incidentLocation}`,
      'fire_relief'
    );
  };

  const handleReject = async (req: FireReliefRequest) => {
    const updated: FireReliefRequest = {
      ...req,
      status: 'rejected',
    };
    await saveRecord('fire_relief_requests', updated, false);
    await pushNotification(
      `ไม่อนุมัติแบบ อค.02 (${req.docNumber})`,
      `${req.incidentLocation}`,
      'fire_relief'
    );
  };

  const buildFormHtml = (req: FireReliefRequest, logoSrc = FOUNDATION_LOGO_PATH): string => {
    const sums = (req.victims || []).reduce(
      (acc, v) => ({
        male: acc.male + Number(v.maleCount || 0),
        female: acc.female + Number(v.femaleCount || 0),
        boy: acc.boy + Number(v.boyCount || 0),
        girl: acc.girl + Number(v.girlCount || 0),
        total: acc.total + Number(v.totalCount || 0),
      }),
      { male: 0, female: 0, boy: 0, girl: 0, total: 0 }
    );

    const rowsToRender =
      req.victims && req.victims.length > 0
        ? req.victims
        : [createEmptyVictim(1)];

    const victimRowsHtml = rowsToRender
      .map(
        (v, idx) => `
        <tr>
          <td style="padding:4px 3px;border:1px solid #334155;text-align:center;vertical-align:middle;">${idx + 1}</td>
          <td style="padding:4px 4px;border:1px solid #334155;text-align:center;vertical-align:middle;white-space:nowrap;">${escapeHtml(v.houseNumber || '-')}</td>
          <td style="padding:4px 6px;border:1px solid #334155;text-align:left;vertical-align:middle;word-break:keep-all;overflow-wrap:break-word;">${escapeHtml(v.fullName || `(${DAMAGE_LABELS[v.damageType]})`)}</td>
          <td style="padding:4px 2px;border:1px solid #334155;text-align:center;vertical-align:middle;font-variant-numeric:tabular-nums;">${v.maleCount || 0}</td>
          <td style="padding:4px 2px;border:1px solid #334155;text-align:center;vertical-align:middle;font-variant-numeric:tabular-nums;">${v.femaleCount || 0}</td>
          <td style="padding:4px 2px;border:1px solid #334155;text-align:center;vertical-align:middle;font-variant-numeric:tabular-nums;">${v.boyCount || 0}</td>
          <td style="padding:4px 2px;border:1px solid #334155;text-align:center;vertical-align:middle;font-variant-numeric:tabular-nums;">${v.girlCount || 0}</td>
          <td style="padding:4px 2px;border:1px solid #334155;text-align:center;vertical-align:middle;font-weight:700;font-variant-numeric:tabular-nums;background:#f8fafc;">${v.totalCount || 0}</td>
          <td style="padding:4px 6px;border:1px solid #334155;text-align:left;vertical-align:middle;word-break:keep-all;overflow-wrap:break-word;">${escapeHtml(v.assistanceDetail || '-')}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;vertical-align:middle;height:28px;word-break:keep-all;overflow-wrap:break-word;">${escapeHtml(v.receiverName || '')}</td>
        </tr>`
      )
      .join('');

    const fullAmt = Number(req.fullDamageCases || 0) * Number(req.fullDamageRate || 0);
    const partialAmt = Number(req.partialDamageCases || 0) * Number(req.partialDamageRate || 0);
    const deadAmt = Number(req.deceasedCases || 0) * Number(req.deceasedRate || 0);
    const riceAmt = Number(req.riceBagTotal || 0) * Number(req.riceBagPrice || 0);
    const waterAmt = Number(req.waterPackTotal || 0) * Number(req.waterPackPrice || 0);
    const blanketAmt = Number(req.blanketTotal || 0) * Number(req.blanketPrice || 0);
    const extraAmt = Number(req.extraReliefValue || 0);

    const certDateText = req.certifiedDate
      ? formatShortLongThaiDate(req.certifiedDate)
      : req.approverSignature?.signedAt
        ? formatShortLongThaiDate(req.approverSignature.signedAt)
        : '....................................';

    const sigImgHtml = req.approverSignature
      ? `<img src="${req.approverSignature.dataUrl}" alt="ลายเซ็น" style="height:36px;max-width:150px;object-fit:contain;margin:4px auto 2px auto;display:block;" />`
      : `<div style="padding:16px 0 4px 0;font-size:11px;color:#64748b;">ลงชื่อ ......................................................</div>`;

    const shaHtml = req.approverSignature
      ? `<div style="font-size:8.5px;font-family:'JetBrains Mono',monospace;color:#64748b;margin-top:2px;">SHA-256: ${escapeHtml(req.approverSignature.sha256.slice(0, 24))}...</div>`
      : '';

    return `
      <div class="ak02-form-sheet" style="font-family:'TH Sarabun New','Sarabun','Noto Sans Thai',sans-serif;color:#0f172a;font-size:11.5px;line-height:1.28;">
        <!-- 1. ส่วนหัวเอกสาร (A4 แนวตั้ง) -->
        <table class="keep-together" style="width:100%;border-collapse:collapse;margin-bottom:7px;border-bottom:2px solid #0f2744;">
          <tr>
            <td style="width:58px;vertical-align:middle;padding:0 8px 6px 0;border:none;">
              <img src="${escapeHtml(logoSrc)}" alt="${FOUNDATION_NAME}" onerror="this.style.display='none'" style="width:50px;height:50px;object-fit:contain;display:block;" />
            </td>
            <td style="vertical-align:middle;padding:0 10px 6px 0;border:none;">
              <div style="font-size:16.5px;font-weight:700;color:#0f2744;line-height:1.18;">${FOUNDATION_NAME}</div>
              <div style="font-size:12px;font-weight:600;color:#334155;margin-top:1px;">รายงานการอนุเคราะห์ผู้ประสบเหตุอัคคีภัย</div>
              <div style="font-size:11.5px;color:#0f172a;margin-top:2px;">
                <strong>เหตุเกิดเมื่อ</strong> ${escapeHtml(formatLongThaiDate(req.incidentDate))}${req.incidentTime ? ` <strong>เวลา</strong> ${escapeHtml(req.incidentTime)} น.` : ''}
              </div>
              <div style="font-size:11.5px;color:#0f172a;margin-top:1px;word-break:keep-all;overflow-wrap:break-word;">
                <strong>สถานที่เกิดเหตุ :</strong> ${escapeHtml(req.incidentLocation)}
              </div>
            </td>
            <td style="width:152px;vertical-align:top;text-align:right;padding:0 0 6px 0;border:none;">
              <div style="display:inline-block;border:1.5px solid #0f2744;border-radius:4px;overflow:hidden;min-width:144px;text-align:center;">
                <div style="background:#0f2744;color:#ffffff;font-size:13px;font-weight:700;padding:2px 8px;">แบบ อค.02</div>
                <div style="background:#f8fafc;color:#0f172a;font-size:11px;font-weight:600;padding:2.5px 6px;border-top:1px solid #0f2744;white-space:nowrap;">
                  เลขที่ ${escapeHtml(req.docNumber)}
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- 2. ตารางรายชื่อผู้ประสบภัย (สัดส่วนแนวตั้ง พอดี 1 หน้า A4) -->
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;line-height:1.28;margin-bottom:7px;">
          <colgroup>
            <col style="width:5%;" />
            <col style="width:9%;" />
            <col style="width:21%;" />
            <col style="width:3.5%;" />
            <col style="width:3.5%;" />
            <col style="width:4%;" />
            <col style="width:4%;" />
            <col style="width:4.5%;" />
            <col style="width:29.5%;" />
            <col style="width:16%;" />
          </colgroup>
          <thead>
            <tr style="background:#f1f5f9;color:#0f2744;">
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">ลำดับ</th>
              <th style="padding:4px 3px;border:1px solid #334155;text-align:center;font-weight:700;">บ้านเลขที่</th>
              <th style="padding:4px 6px;border:1px solid #334155;text-align:left;font-weight:700;">ชื่อ - สกุล</th>
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">ช.</th>
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">ญ.</th>
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">ด.ช.</th>
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">ด.ญ.</th>
              <th style="padding:4px 2px;border:1px solid #334155;text-align:center;font-weight:700;">รวม</th>
              <th style="padding:4px 6px;border:1px solid #334155;text-align:left;font-weight:700;">ความช่วยเหลือ</th>
              <th style="padding:4px 5px;border:1px solid #334155;text-align:center;font-weight:700;">ผู้รับ (ลงชื่อ)</th>
            </tr>
          </thead>
          <tbody>
            ${victimRowsHtml}
            <tr style="background:#f8fafc;font-weight:700;color:#0f172a;">
              <td colspan="3" style="padding:4px 6px;border:1px solid #334155;text-align:right;">รวมจำนวนผู้ประสบภัย</td>
              <td style="padding:4px 2px;border:1px solid #334155;text-align:center;font-variant-numeric:tabular-nums;">${sums.male}</td>
              <td style="padding:4px 2px;border:1px solid #334155;text-align:center;font-variant-numeric:tabular-nums;">${sums.female}</td>
              <td style="padding:4px 2px;border:1px solid #334155;text-align:center;font-variant-numeric:tabular-nums;">${sums.boy}</td>
              <td style="padding:4px 2px;border:1px solid #334155;text-align:center;font-variant-numeric:tabular-nums;">${sums.girl}</td>
              <td style="padding:4px 2px;border:1px solid #334155;text-align:center;font-variant-numeric:tabular-nums;background:#e2e8f0;color:#0f2744;">${sums.total}</td>
              <td colspan="2" style="padding:4px 6px;border:1px solid #334155;text-align:center;font-weight:600;color:#334155;">รวมทั้งสิ้น ${sums.total} ราย (${rowsToRender.length} ครัวเรือน)</td>
            </tr>
          </tbody>
        </table>

        <!-- เส้นคั่นแบ่งระหว่างตารางรายชื่อผู้ประสบภัยกับส่วนสรุปยอดและลงนาม -->
        <div style="border-top:2px solid #0f2744;margin:7px 0 7px 0;"></div>

        <!-- 3. ส่วนสรุปยอดเงินและสิ่งของ (จัดชิดขวาตรงหลักทศนิยม) + ส่วนลงนามรับรอง -->
        <table class="keep-together" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:7px;">
          <tr>
            <td style="width:60%;vertical-align:top;padding:0 10px 0 0;border:none;">
              <table style="width:100%;border-collapse:collapse;font-size:10.8px;line-height:1.25;">
                <thead>
                  <tr style="background:#f1f5f9;color:#0f2744;">
                    <th style="padding:3.5px 6px;border:1px solid #64748b;text-align:left;font-weight:700;">รายการสรุปยอดเงินบริจาคและสิ่งของบรรเทาทุกข์</th>
                    <th style="padding:3.5px 8px;border:1px solid #64748b;text-align:right;width:100px;font-weight:700;">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:3px 6px;border:1px solid #cbd5e1;">เสียหายทั้งหมดบริจาค ${req.fullDamageCases} รายๆ ละ ${Number(req.fullDamageRate).toLocaleString('th-TH')} บาท</td>
                    <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(fullAmt)}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 6px;border:1px solid #cbd5e1;">เสียหายบางส่วนบริจาค ${req.partialDamageCases} รายๆ ละ ${Number(req.partialDamageRate).toLocaleString('th-TH')} บาท</td>
                    <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(partialAmt)}</td>
                  </tr>
                  ${
                    (req.deceasedCases || 0) > 0
                      ? `<tr>
                          <td style="padding:3px 6px;border:1px solid #cbd5e1;">กรณีเสียชีวิตบริจาค ${req.deceasedCases} รายๆ ละ ${Number(req.deceasedRate || 0).toLocaleString('th-TH')} บาท</td>
                          <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(deadAmt)}</td>
                        </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:3px 6px;border:1px solid #cbd5e1;">บริจาคเป็นข้าวสารรายละ ${req.riceBagsPerCase} ถุง จำนวน ${req.riceBagTotal} ถุงๆ ละ ${Number(req.riceBagPrice).toLocaleString('th-TH')} บาท</td>
                    <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(riceAmt)}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 6px;border:1px solid #cbd5e1;">น้ำตราสิงห์รายละ ${req.waterPacksPerCase} แพค จำนวน ${req.waterPackTotal} แพคๆ ละ ${Number(req.waterPackPrice).toLocaleString('th-TH')} บาท</td>
                    <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(waterAmt)}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 6px;border:1px solid #cbd5e1;">ผ้าห่มรายละ ${req.blanketsPerCase} ผืน จำนวน ${req.blanketTotal} ผืนๆ ละ ${Number(req.blanketPrice).toLocaleString('th-TH')} บาท</td>
                    <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(blanketAmt)}</td>
                  </tr>
                  ${
                    extraAmt > 0 || req.extraReliefNote
                      ? `<tr>
                          <td style="padding:3px 6px;border:1px solid #cbd5e1;">${escapeHtml(req.extraReliefNote || 'รายการช่วยเหลือเพิ่มเติม')}</td>
                          <td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(extraAmt)}</td>
                        </tr>`
                      : ''
                  }
                  <tr style="background:#f8fafc;font-weight:700;color:#0f172a;">
                    <td style="padding:4px 6px;border:1px solid #334155;text-align:right;font-weight:700;">มูลค่ารวม (บาท)</td>
                    <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(req.totalValue)}</td>
                  </tr>
                  <tr style="background:#f1f5f9;font-weight:700;color:#0f2744;">
                    <td style="padding:4px 6px;border:1px solid #334155;text-align:right;font-weight:700;">เบิกเงินสด (บาท)</td>
                    <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(req.cashDisbursed)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style="width:40%;vertical-align:top;padding:0;border:none;">
              <div style="border:1px solid #334155;border-radius:6px;padding:8px 10px;text-align:center;background:#ffffff;">
                <div style="font-size:11.5px;font-weight:700;color:#0f2744;">ขอรับรองว่าเป็นความจริง</div>
                ${sigImgHtml}
                <div style="font-size:11.5px;font-weight:700;color:#0f172a;margin-top:2px;">(${escapeHtml(req.approverSignature?.signerName || 'นางสาวศาตพร ภูมิโคกรักษ์')})</div>
                <div style="font-size:10.5px;color:#334155;margin-top:1px;">${escapeHtml(req.approverSignature?.signerPosition || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ')}</div>
                <div style="font-size:10.5px;color:#0f172a;margin-top:4px;">ลงวันที่ ${escapeHtml(certDateText)}</div>
                ${shaHtml}
              </div>
              ${
                req.recorderName
                  ? `<div style="margin-top:4px;text-align:right;font-size:10px;color:#475569;">ผู้บันทึกรายงาน: ${escapeHtml(req.recorderName)}</div>`
                  : ''
              }
            </td>
          </tr>
        </table>

        <!-- 4. หมายเหตุ 2 คอลัมน์ซ้าย-ขวา (พอดีใน 1 หน้า A4 แนวตั้ง) -->
        <table class="keep-together" style="width:100%;border-collapse:collapse;table-layout:fixed;border-top:1.5px solid #334155;font-size:10px;line-height:1.28;">
          <tr>
            <td style="width:50%;vertical-align:top;padding:5px 10px 0 0;border:none;">
              <div style="font-weight:700;color:#0f2744;margin-bottom:2px;">หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียหาย</div>
              ${FIRE_RELIEF_DAMAGED_NOTES.map((line) => `<div style="color:#1e293b;padding-left:6px;">${escapeHtml(line)}</div>`).join('')}
            </td>
            <td style="width:50%;vertical-align:top;padding:5px 0 0 10px;border:none;">
              <div style="font-weight:700;color:#0f2744;margin-bottom:2px;">หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียชีวิต</div>
              ${FIRE_RELIEF_DECEASED_NOTES.map((line) => `<div style="color:#1e293b;padding-left:6px;">${escapeHtml(line)}</div>`).join('')}
            </td>
          </tr>
        </table>
        ${
          req.notes
            ? `<div style="margin-top:3px;font-size:10px;color:#334155;"><strong>บันทึกเพิ่มเติม:</strong> ${escapeHtml(req.notes)}</div>`
            : ''
        }
      </div>
    `;
  };

  const buildStandaloneHtmlDoc = (req: FireReliefRequest): string => {
    const absoluteLogoUrl =
      typeof window !== 'undefined' && FOUNDATION_LOGO_PATH.startsWith('/')
        ? `${window.location.origin}${FOUNDATION_LOGO_PATH}`
        : FOUNDATION_LOGO_PATH;
    const bodyHtml = buildFormHtml(req, absoluteLogoUrl);
    return `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>แบบ อค.02 ${escapeHtml(req.docNumber)} - ${FOUNDATION_NAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 9mm 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      font-family: 'TH Sarabun New', 'Sarabun', 'Noto Sans Thai', sans-serif;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      background: #ffffff;
      border-bottom: 1px solid #cbd5e1;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .toolbar button {
      font-family: 'Sarabun', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 7px 16px;
      border-radius: 6px;
      border: none;
      background: #0f2744;
      color: #ffffff;
      cursor: pointer;
    }
    .a4-page {
      width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      padding: 9mm 10mm;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.12);
    }
    .keep-together {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
      .a4-page {
        width: 100%;
        min-height: 0;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">พิมพ์ / บันทึก PDF (A4 แนวตั้ง)</button>
  </div>
  <main class="a4-page">
    ${bodyHtml}
  </main>
</body>
</html>`;
  };

  const handlePrintPdf = (req: FireReliefRequest) => {
    const html = buildFormHtml(req);
    openPrintPreview(
      `แบบ อค.02 อนุเคราะห์ผู้ประสบเหตุเพลิงไหม้ (${req.docNumber})`,
      `form_or_kor_02_${req.docNumber}`,
      html,
      'portrait'
    );
  };

  const handleDownloadHtml = (req: FireReliefRequest) => {
    const fullHtml = buildStandaloneHtmlDoc(req);
    const blob = new Blob(['\uFEFF' + fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `แบบ_อค.02_${req.docNumber.replace(/[^\w\u0E00-\u0E7F-]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadDoc = (req: FireReliefRequest) => {
    const html = buildFormHtml(req);
    exportToGoogleDocsFile(
      `แบบ อค.02 ${req.docNumber}`,
      html,
      `แบบ_อค.02_${req.docNumber.replace(/[^\w\u0E00-\u0E7F-]/g, '_')}`,
      'portrait'
    );
  };

  const handleDownloadExcel = (req: FireReliefRequest) => {
    const sums = (req.victims || []).reduce(
      (acc, v) => ({
        male: acc.male + Number(v.maleCount || 0),
        female: acc.female + Number(v.femaleCount || 0),
        boy: acc.boy + Number(v.boyCount || 0),
        girl: acc.girl + Number(v.girlCount || 0),
        total: acc.total + Number(v.totalCount || 0),
      }),
      { male: 0, female: 0, boy: 0, girl: 0, total: 0 }
    );

    const fullAmt = Number(req.fullDamageCases || 0) * Number(req.fullDamageRate || 0);
    const partialAmt = Number(req.partialDamageCases || 0) * Number(req.partialDamageRate || 0);
    const deadAmt = Number(req.deceasedCases || 0) * Number(req.deceasedRate || 0);
    const riceAmt = Number(req.riceBagTotal || 0) * Number(req.riceBagPrice || 0);
    const waterAmt = Number(req.waterPackTotal || 0) * Number(req.waterPackPrice || 0);
    const blanketAmt = Number(req.blanketTotal || 0) * Number(req.blanketPrice || 0);
    const extraAmt = Number(req.extraReliefValue || 0);

    const certDateText = req.certifiedDate
      ? formatShortLongThaiDate(req.certifiedDate)
      : req.approverSignature?.signedAt
        ? formatShortLongThaiDate(req.approverSignature.signedAt)
        : '................................';

    const aoa: (string | number)[][] = [
      ['', '', '', '', '', '', '', '', '', `แบบ อค.02 (${req.docNumber})`],
      [FOUNDATION_NAME, '', '', '', '', '', '', '', '', ''],
      [
        `เหตุเกิดเมื่อ ${formatLongThaiDate(req.incidentDate)}${req.incidentTime ? ` เวลา ${req.incidentTime} น.` : ''}`,
        '', '', '', '', '', '', '', '', '',
      ],
      [req.incidentLocation, '', '', '', '', '', '', '', '', ''],
      [],
      ['ลำดับ', 'บ้านเลขที่', 'ชื่อ - สกุล', 'ช.', 'ญ.', 'ด.ช.', 'ด.ญ.', 'รวม', 'ความช่วยเหลือ', 'ผู้รับ'],
      ...(req.victims || []).map((v, idx) => [
        idx + 1,
        v.houseNumber || '',
        v.fullName || `(${DAMAGE_LABELS[v.damageType]})`,
        Number(v.maleCount || 0),
        Number(v.femaleCount || 0),
        Number(v.boyCount || 0),
        Number(v.girlCount || 0),
        Number(v.totalCount || 0),
        v.assistanceDetail || '',
        v.receiverName || '',
      ]),
      ['', '', 'รวมจำนวนผู้ประสบภัย', sums.male, sums.female, sums.boy, sums.girl, sums.total, 'ขอรับรองว่าเป็นความจริง', ''],
      [`เสียหายทั้งหมดบริจาค ${req.fullDamageCases} รายๆละ ${req.fullDamageRate} บาท`, '', '', fullAmt, '', '', '', '', '', ''],
      [`เสียหายบางส่วนบริจาค ${req.partialDamageCases} รายๆละ ${req.partialDamageRate} บาท`, '', '', partialAmt, '', '', '', '', req.approverSignature?.signerName || 'นางสาวศาตพร ภูมิโคกรักษ์', ''],
      ...(Number(req.deceasedCases || 0) > 0
        ? [[`กรณีเสียชีวิตบริจาค ${req.deceasedCases} รายๆละ ${req.deceasedRate || 0} บาท`, '', '', deadAmt, '', '', '', '', '', '']]
        : []),
      [`บริจาคเป็นข้าวสารรายละ ${req.riceBagsPerCase} ถุง จำนวน ${req.riceBagTotal} ถุงๆละ ${req.riceBagPrice} บาท`, '', '', riceAmt, '', '', '', '', req.approverSignature?.signerPosition || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ', ''],
      [`น้ำตราสิงห์รายละ ${req.waterPacksPerCase} แพค จำนวน ${req.waterPackTotal} แพคๆละ ${req.waterPackPrice} บาท`, '', '', waterAmt, '', '', '', '', `ลงวันที่ ${certDateText}`, ''],
      [`ผ้าห่มรายละ ${req.blanketsPerCase} ผืน จำนวน ${req.blanketTotal} ผืนๆละ ${req.blanketPrice} บาท`, '', '', blanketAmt, '', '', '', '', '', ''],
      ...(extraAmt > 0 || req.extraReliefNote
        ? [[req.extraReliefNote || 'รายการช่วยเหลือเพิ่มเติม', '', '', extraAmt, '', '', '', '', '', '']]
        : []),
      ['', '', 'มูลค่ารวม', req.totalValue, '', '', '', '', 'บาท', ''],
      [],
      ['', '', 'เบิกเงินสด', req.cashDisbursed, '', '', '', '', 'บาท', ''],
      [],
      ['หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียหาย'],
      ...FIRE_RELIEF_DAMAGED_NOTES.map((n) => [n]),
      ['หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียชีวิต'],
      ...FIRE_RELIEF_DECEASED_NOTES.map((n) => [n]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 30 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 8 },
      { wch: 44 },
      { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แบบ อค.02');
    XLSX.writeFile(wb, `แบบ_อค.02_${req.docNumber.replace(/[^\w\u0E00-\u0E7F-]/g, '_')}.xlsx`);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...fireReliefRequests]
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (!q) return true;
        return (
          r.docNumber.toLowerCase().includes(q) ||
          r.incidentLocation.toLowerCase().includes(q) ||
          (r.victims || []).some(
            (v) =>
              v.fullName.toLowerCase().includes(q) ||
              v.houseNumber.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
  }, [fireReliefRequests, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const totalCases = fireReliefRequests.length;
    const totalVictims = fireReliefRequests.reduce(
      (sum, r) => sum + (r.victims || []).reduce((s, v) => s + Number(v.totalCount || 0), 0),
      0
    );
    const totalAid = fireReliefRequests.reduce((sum, r) => sum + Number(r.totalValue || 0), 0);
    const totalCash = fireReliefRequests.reduce((sum, r) => sum + Number(r.cashDisbursed || 0), 0);
    return { totalCases, totalVictims, totalAid, totalCash };
  }, [fireReliefRequests]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FlameKindling className="w-5 h-5 text-red-700" />
            ระบบอนุเคราะห์ผู้ประสบเหตุเพลิงไหม้ (แบบ อค.02)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกรายชื่อผู้ประสบภัย คำนวณเงินสงเคราะห์และสิ่งของบรรเทาทุกข์ รองรับดาวน์โหลด Excel (.xlsx), Word/Docs (.doc), HTML (A4 แนวตั้ง) และสั่งพิมพ์ PDF (A4 แนวตั้ง)
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          บันทึกเหตุเพลิงไหม้ (อค.02)
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">จำนวนเหตุที่บันทึก</div>
          <div className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
            {stats.totalCases} เหตุการณ์
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">ผู้ประสบภัยรวมทั้งหมด</div>
          <div className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
            {stats.totalVictims} ราย
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">มูลค่าการช่วยเหลือรวม</div>
          <div className="font-display text-xl font-bold text-blue-900 tabular-nums mt-1">
            {formatCurrency(stats.totalAid)} บาท
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">เบิกเงินสดสะสม</div>
          <div className="font-display text-xl font-bold text-emerald-700 tabular-nums mt-1">
            {formatCurrency(stats.totalCash)} บาท
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              ['all', 'ทั้งหมด'],
              ['pending', 'รออนุมัติ'],
              ['approved', 'อนุมัติแล้ว'],
              ['rejected', 'ไม่อนุมัติ'],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatusFilter(k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                statusFilter === k ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่ อค.02, สถานที่, ชื่อผู้ประสบภัย..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">เลขที่แบบ</th>
                <th className="py-3 px-4">วันเวลา / สถานที่เกิดเหตุ</th>
                <th className="py-3 px-4">จำนวนครัวเรือน / ผู้ประสบภัย</th>
                <th className="py-3 px-4 text-right">มูลค่ารวม / เบิกเงินสด</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">ส่งออก & ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    ยังไม่มีรายการอนุเคราะห์ผู้ประสบเหตุเพลิงไหม้
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const peopleCount = (req.victims || []).reduce(
                    (sum, v) => sum + Number(v.totalCount || 0),
                    0
                  );
                  const canEdit =
                    currentStaff?.role === 'Admin' ||
                    (req.status !== 'approved' &&
                      req.status !== 'rejected' &&
                      (canManageRegistry || req.createdBy === currentStaff?.id));

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                        {req.docNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{req.incidentLocation}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {formatShortLongThaiDate(req.incidentDate)}
                          {req.incidentTime ? ` เวลา ${req.incidentTime} น.` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">
                        <div>{(req.victims || []).length} รายการ · ผู้ประสบภัย {peopleCount} คน</div>
                        <div className="text-slate-500">
                          เสียหายทั้งหลัง {req.fullDamageCases} · บางส่วน {req.partialDamageCases}
                          {(req.deceasedCases || 0) > 0 ? ` · เสียชีวิต ${req.deceasedCases}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-xs tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(req.totalValue)} บาท
                        </div>
                        <div className="text-emerald-700">
                          เบิกเงินสด {formatCurrency(req.cashDisbursed)} บาท
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            req.status === 'approved'
                              ? 'text-emerald-700'
                              : req.status === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {req.status === 'approved'
                            ? 'อนุมัติรับรองแล้ว'
                            : req.status === 'rejected'
                              ? 'ไม่อนุมัติ'
                              : 'รอผู้จัดการรับรอง'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(req)}
                              className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                              title="แก้ไขข้อมูล อค.02"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {req.status === 'pending' && canApproveTier2 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSigPromptReq(req)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                รับรอง
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(req)}
                                className="p-2 text-red-700 hover:bg-red-50 rounded-lg"
                                title="ไม่อนุมัติ"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadExcel(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                            title="ดาวน์โหลดไฟล์ Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Excel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                            title="ดาวน์โหลดไฟล์ DOC (.doc)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            DOC
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadHtml(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                            title="ดาวน์โหลดไฟล์ HTML + CSS (A4 แนวตั้ง)"
                          >
                            <FileCode2 className="w-3.5 h-3.5" />
                            HTML
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintPdf(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                            title="สั่งพิมพ์ / PDF (A4 แนวตั้ง)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            พิมพ์
                          </button>
                          {currentStaff?.role === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => removeRecord('fire_relief_requests', req.id)}
                              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-[95vw] xl:max-w-[1400px] max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {editingReq
                    ? `แก้ไขแบบ อค.02 (${editingReq.docNumber})`
                    : 'แบบ อค.02 · บันทึกการอนุเคราะห์ผู้ประสบเหตุเพลิงไหม้'}
                </h3>
                <p className="text-xs text-slate-500">
                  {FOUNDATION_NAME} · กรอกข้อมูลเหตุเพลิงไหม้ รายชื่อผู้ประสบภัย และสรุปค่าใช้จ่ายการช่วยเหลือ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="w-full p-5 sm:p-6 space-y-6">
              {/* Section 1: Incident Info */}
              <div className="space-y-4">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 1 · ข้อมูลเหตุเพลิงไหม้ (หัวแบบ อค.02)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่เกิดเหตุ (วัน / เดือน / พ.ศ.)
                    </label>
                    <ThaiBeDateInput
                      value={incidentDate}
                      onChange={setIncidentDate}
                      required
                      labelPrefix="วันที่เกิดเหตุ"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เวลาเกิดเหตุ (น.)
                    </label>
                    <input
                      type="text"
                      value={incidentTime}
                      onChange={(e) => setIncidentTime(e.target.value)}
                      placeholder="เช่น 10.30"
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ลงวันที่รับรอง (วัน / เดือน / พ.ศ.)
                    </label>
                    <ThaiBeDateInput
                      value={certifiedDate}
                      onChange={setCertifiedDate}
                      labelPrefix="ลงวันที่รับรอง"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ผู้บันทึกรายงาน
                    </label>
                    <input
                      type="text"
                      value={recorderName}
                      onChange={(e) => setRecorderName(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    สถานที่เกิดเหตุ (หมู่ / ซอย / ถนน / ตำบล / อำเภอ / จังหวัด)
                  </label>
                  <input
                    type="text"
                    required
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="เช่น หมู่ที่ 1 ต.แพรกษาใหม่ อ.เมือง จ.สมุทรปราการ"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Section 2: Victims Table */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h4 className="font-display text-sm font-semibold text-slate-900">
                    ส่วนที่ 2 · ตารางรายชื่อผู้ประสบเหตุเพลิงไหม้ (ลำดับ, บ้านเลขที่, ชื่อ-สกุล, ช./ญ./ด.ช./ด.ญ., ความช่วยเหลือ)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={autoSyncFromVictims}
                      className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                    >
                      คำนวณยอดรายการด้านล่างอัตโนมัติ
                    </button>
                    <button
                      type="button"
                      onClick={addVictimRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มรายชื่อ
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-2 text-center w-10">ลำดับ</th>
                        <th className="py-2 px-2 w-24">บ้านเลขที่</th>
                        <th className="py-2 px-2 min-w-[160px]">ชื่อ - สกุล / รายการ</th>
                        <th className="py-2 px-2 w-28">ความเสียหาย</th>
                        <th className="py-2 px-1.5 text-center w-12">ช.</th>
                        <th className="py-2 px-1.5 text-center w-12">ญ.</th>
                        <th className="py-2 px-1.5 text-center w-12">ด.ช.</th>
                        <th className="py-2 px-1.5 text-center w-12">ด.ญ.</th>
                        <th className="py-2 px-2 text-center w-12">รวม</th>
                        <th className="py-2 px-2 min-w-[200px]">ความช่วยเหลือ</th>
                        <th className="py-2 px-2 w-28">ผู้รับ</th>
                        <th className="py-2 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {victims.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2 text-center font-medium text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={row.houseNumber}
                              onChange={(e) =>
                                updateVictimField(idx, 'houseNumber', e.target.value)
                              }
                              placeholder="บ้านเลขที่"
                              className="w-full h-8 px-2 border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={row.fullName}
                              onChange={(e) =>
                                updateVictimField(idx, 'fullName', e.target.value)
                              }
                              placeholder="ชื่อ-สกุล หรือกลุ่มครัวเรือน"
                              className="w-full h-8 px-2 border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <select
                              value={row.damageType}
                              onChange={(e) =>
                                updateVictimField(
                                  idx,
                                  'damageType',
                                  e.target.value as FireReliefVictim['damageType']
                                )
                              }
                              className="w-full h-8 px-1.5 bg-white border border-slate-300 rounded"
                            >
                              <option value="full">เสียหายทั้งหลัง</option>
                              <option value="partial">เสียหายบางส่วน</option>
                              <option value="deceased">เสียชีวิต</option>
                              <option value="other">อื่นๆ</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              min={0}
                              value={row.maleCount}
                              onChange={(e) =>
                                updateVictimField(idx, 'maleCount', Number(e.target.value || 0))
                              }
                              className="w-full h-8 px-1 text-center border border-slate-300 rounded tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              min={0}
                              value={row.femaleCount}
                              onChange={(e) =>
                                updateVictimField(idx, 'femaleCount', Number(e.target.value || 0))
                              }
                              className="w-full h-8 px-1 text-center border border-slate-300 rounded tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              min={0}
                              value={row.boyCount}
                              onChange={(e) =>
                                updateVictimField(idx, 'boyCount', Number(e.target.value || 0))
                              }
                              className="w-full h-8 px-1 text-center border border-slate-300 rounded tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              min={0}
                              value={row.girlCount}
                              onChange={(e) =>
                                updateVictimField(idx, 'girlCount', Number(e.target.value || 0))
                              }
                              className="w-full h-8 px-1 text-center border border-slate-300 rounded tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold text-slate-900 tabular-nums">
                            {row.totalCount}
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={row.assistanceDetail}
                              onChange={(e) =>
                                updateVictimField(idx, 'assistanceDetail', e.target.value)
                              }
                              placeholder="เช่น เงินสด 1,500 บาท ข้าวสาร 5 กก. 2 ถุง น้ำดื่ม 2 แพ็ค ผ้าห่ม 1 ผืน"
                              className="w-full h-8 px-2 border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={row.receiverName}
                              onChange={(e) =>
                                updateVictimField(idx, 'receiverName', e.target.value)
                              }
                              placeholder="ชื่อผู้รับ"
                              className="w-full h-8 px-2 border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeVictimRow(idx)}
                              disabled={victims.length <= 1}
                              className="p-1 text-slate-400 hover:text-red-700 disabled:opacity-30"
                              title="ลบแถว"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold text-slate-800">
                        <td colSpan={4} className="py-2 px-3 text-right">
                          รวมจำนวนผู้ประสบภัย
                        </td>
                        <td className="py-2 px-1 text-center tabular-nums">{victimTotals.male}</td>
                        <td className="py-2 px-1 text-center tabular-nums">{victimTotals.female}</td>
                        <td className="py-2 px-1 text-center tabular-nums">{victimTotals.boy}</td>
                        <td className="py-2 px-1 text-center tabular-nums">{victimTotals.girl}</td>
                        <td className="py-2 px-2 text-center text-blue-900 tabular-nums">
                          {victimTotals.total}
                        </td>
                        <td colSpan={3} className="py-2 px-2 text-slate-500">
                          คน
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Financial & Supply Summary */}
              <div className="space-y-3">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 3 · สรุปการบริจาค มูลค่ารวม และเบิกเงินสด
                </h4>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5 text-xs">
                    <div className="font-semibold text-slate-800">เงินสงเคราะห์ (เบิกเงินสด)</div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-slate-700">เสียหายทั้งหมดบริจาค</span>
                      <input
                        type="number"
                        min={0}
                        value={fullDamageCases}
                        onChange={(e) => setFullDamageCases(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-center text-slate-500">รายๆละ</span>
                      <input
                        type="number"
                        min={0}
                        value={fullDamageRate}
                        onChange={(e) => setFullDamageRate(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(fullDamageAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-slate-700">เสียหายบางส่วนบริจาค</span>
                      <input
                        type="number"
                        min={0}
                        value={partialDamageCases}
                        onChange={(e) => setPartialDamageCases(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-center text-slate-500">รายๆละ</span>
                      <input
                        type="number"
                        min={0}
                        value={partialDamageRate}
                        onChange={(e) => setPartialDamageRate(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(partialDamageAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-slate-700">กรณีเสียชีวิตบริจาค</span>
                      <input
                        type="number"
                        min={0}
                        value={deceasedCases}
                        onChange={(e) => setDeceasedCases(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-center text-slate-500">รายๆละ</span>
                      <input
                        type="number"
                        min={0}
                        value={deceasedRate}
                        onChange={(e) => setDeceasedRate(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(deceasedAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5 text-xs">
                    <div className="font-semibold text-slate-800">เครื่องอุปโภค-บริโภคและสิ่งของ</div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-3 text-slate-700">ข้าวสาร (รายละ)</span>
                      <input
                        type="number"
                        min={0}
                        value={riceBagsPerCase}
                        onChange={(e) => setRiceBagsPerCase(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-1 text-slate-500 text-center">รวม</span>
                      <input
                        type="number"
                        min={0}
                        value={riceBagTotal}
                        onChange={(e) => setRiceBagTotal(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <input
                        type="number"
                        min={0}
                        value={riceBagPrice}
                        onChange={(e) => setRiceBagPrice(Number(e.target.value || 0))}
                        title="ราคาต่อถุง (บาท)"
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(riceAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-3 text-slate-700">น้ำตราสิงห์ (รายละ)</span>
                      <input
                        type="number"
                        min={0}
                        value={waterPacksPerCase}
                        onChange={(e) => setWaterPacksPerCase(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-1 text-slate-500 text-center">รวม</span>
                      <input
                        type="number"
                        min={0}
                        value={waterPackTotal}
                        onChange={(e) => setWaterPackTotal(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <input
                        type="number"
                        min={0}
                        value={waterPackPrice}
                        onChange={(e) => setWaterPackPrice(Number(e.target.value || 0))}
                        title="ราคาต่อแพ็ค (บาท)"
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(waterAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-3 text-slate-700">ผ้าห่ม (รายละ)</span>
                      <input
                        type="number"
                        min={0}
                        value={blanketsPerCase}
                        onChange={(e) => setBlanketsPerCase(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-1 text-slate-500 text-center">รวม</span>
                      <input
                        type="number"
                        min={0}
                        value={blanketTotal}
                        onChange={(e) => setBlanketTotal(Number(e.target.value || 0))}
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <input
                        type="number"
                        min={0}
                        value={blanketPrice}
                        onChange={(e) => setBlanketPrice(Number(e.target.value || 0))}
                        title="ราคาต่อผืน (บาท)"
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(blanketAmount)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center pt-1">
                      <input
                        type="text"
                        value={extraReliefNote}
                        onChange={(e) => setExtraReliefNote(e.target.value)}
                        placeholder="รายการเพิ่มเติม (ถ้ามี เช่น ชุดยังชีพ/ของใช้)"
                        className="col-span-8 h-8 px-2 border border-slate-300 rounded bg-white"
                      />
                      <input
                        type="number"
                        min={0}
                        value={extraReliefValue}
                        onChange={(e) => setExtraReliefValue(Number(e.target.value || 0))}
                        placeholder="มูลค่า (บาท)"
                        className="col-span-2 h-8 px-1.5 border border-slate-300 rounded bg-white text-right tabular-nums"
                      />
                      <span className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(extraAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/70 border border-blue-200 rounded-lg p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">มูลค่ารวมทั้งหมด</span>
                    <span className="font-display text-lg font-bold text-blue-900 tabular-nums">
                      {formatCurrency(totalValue)} บาท
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">เบิกเงินสด</span>
                    <span className="font-display text-lg font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(cashDisbursed)} บาท
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Attachments & Notes */}
              <div className="space-y-3">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 4 · หลักฐานขอรับการสงเคราะห์ (กรณีเสียหาย / กรณีเสียชีวิต)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.key}
                      className="flex items-center justify-between gap-2 p-2.5 border border-slate-200 rounded-lg text-xs"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={att.verified}
                          onChange={() => toggleAttachmentCheck(att.key)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-900"
                        />
                        <span className="font-medium text-slate-800">{att.label}</span>
                        <span className="text-[11px] text-slate-500">
                          ({att.caseGroup === 'damaged' ? 'กรณีเสียหาย' : 'กรณีเสียชีวิต'})
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-900 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 shrink-0">
                        <Upload className="w-3 h-3" />
                        {att.fileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์'}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            handleAttachmentFile(att.key, e.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติมสำหรับเอกสารแบบ อค.02"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {validationWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      จุดตรวจสอบความถูกต้องของข้อมูลและตัวเลขก่อนสั่งพิมพ์
                    </div>
                    {validationWarnings.some((w) => w.kind === 'supply') && (
                      <button
                        type="button"
                        onClick={autoSyncFromVictims}
                        className="px-2.5 py-1 text-xs font-medium text-amber-950 bg-amber-200/80 hover:bg-amber-200 rounded-md"
                      >
                        ปรับยอดสิ่งของตาม {activeVictimRows.length} รายอัตโนมัติ
                      </button>
                    )}
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                    {validationWarnings.map((w, idx) => (
                      <li key={idx}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C]"
                >
                  {editingReq ? 'บันทึกการแก้ไข' : 'บันทึกแบบ อค.02'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sigPromptReq && (
        <SignaturePadModal
          open={true}
          title={`ลงนามรับรองแบบ อค.02 (${sigPromptReq.docNumber})`}
          signerName={currentStaff?.fullName || 'นางสาวศาตพร ภูมิโคกรักษ์'}
          signerPosition={currentStaff?.position || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ'}
          documentRef={sigPromptReq.docNumber}
          savedSignatureDataUrl={currentStaff?.signatureDataUrl}
          onClose={() => setSigPromptReq(null)}
          onConfirm={async (sig) => {
            await handleApproveWithSignature(sigPromptReq, sig);
            setSigPromptReq(null);
          }}
        />
      )}
    </div>
  );
};
