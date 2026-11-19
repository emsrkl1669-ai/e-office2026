import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Edit3,
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

function formatLongThaiDate(dateStr?: string): string {
  if (!dateStr) return '....................................';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortLongThaiDate(dateStr?: string): string {
  if (!dateStr) return '................................';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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
      (v) => v.fullName.trim() || v.houseNumber.trim() || v.assistanceDetail.trim()
    );
    const fullCount = activeRows.filter((v) => v.damageType === 'full').length;
    const partialCount = activeRows.filter((v) => v.damageType === 'partial').length;
    const deadCount = activeRows.filter((v) => v.damageType === 'deceased').length;
    const totalCases = fullCount + partialCount + deadCount;

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

  const buildFormHtml = (req: FireReliefRequest): string => {
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
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${idx + 1}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${escapeHtml(v.houseNumber || '-')}</td>
          <td style="padding:5px 6px;border:1px solid #334155;">${escapeHtml(v.fullName || `(${DAMAGE_LABELS[v.damageType]})`)}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${v.maleCount || 0}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${v.femaleCount || 0}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${v.boyCount || 0}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${v.girlCount || 0}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;font-weight:700;">${v.totalCount || 0}</td>
          <td style="padding:5px 6px;border:1px solid #334155;">${escapeHtml(v.assistanceDetail || '-')}</td>
          <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${escapeHtml(v.receiverName || '')}</td>
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
        : '................................';

    const sigImgHtml = req.approverSignature
      ? `<img src="${req.approverSignature.dataUrl}" alt="ลายเซ็น" style="height:44px;max-width:150px;object-fit:contain;margin:4px auto;display:block;" />`
      : `<div style="height:36px;"></div>`;

    const shaHtml = req.approverSignature
      ? `<div style="font-size:9.5px;font-family:monospace;color:#64748b;margin-top:3px;">SHA-256: ${escapeHtml(req.approverSignature.sha256.slice(0, 24))}...</div>`
      : '';

    return `
      <div class="keep-together" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${FOUNDATION_LOGO_PATH}" alt="${FOUNDATION_NAME}" style="width:54px;height:54px;object-fit:contain;" />
          <div>
            <div style="font-size:17px;font-weight:700;color:#0f2744;">${FOUNDATION_NAME}</div>
            <div style="font-size:13px;color:#0f172a;margin-top:2px;">
              เหตุเกิดเมื่อ ${escapeHtml(formatLongThaiDate(req.incidentDate))}${req.incidentTime ? ` เวลา ${escapeHtml(req.incidentTime)} น.` : ''}
            </div>
            <div style="font-size:13px;color:#0f172a;">
              สถานที่เกิดเหตุ: ${escapeHtml(req.incidentLocation)}
            </div>
          </div>
        </div>
        <div style="text-align:right;white-space:nowrap;">
          <div style="font-size:15px;font-weight:700;color:#0f2744;border:1px solid #0f2744;padding:3px 10px;border-radius:4px;">แบบ อค.02</div>
          <div style="font-size:11.5px;font-family:monospace;color:#475569;margin-top:3px;">เลขที่ ${escapeHtml(req.docNumber)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:40px;">ลำดับ</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:78px;">บ้านเลขที่</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:left;">ชื่อ - สกุล</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:32px;">ช.</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:32px;">ญ.</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:36px;">ด.ช.</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:36px;">ด.ญ.</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:40px;">รวม</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:left;">ความช่วยเหลือ</th>
            <th style="padding:5px 6px;border:1px solid #334155;text-align:center;width:85px;">ผู้รับ</th>
          </tr>
        </thead>
        <tbody>
          ${victimRowsHtml}
          <tr style="background:#f8fafc;font-weight:700;">
            <td colspan="3" style="padding:5px 8px;border:1px solid #334155;text-align:center;">รวมจำนวนผู้ประสบภัย</td>
            <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${sums.male}</td>
            <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${sums.female}</td>
            <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${sums.boy}</td>
            <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${sums.girl}</td>
            <td style="padding:5px 6px;border:1px solid #334155;text-align:center;">${sums.total}</td>
            <td colspan="2" style="padding:5px 8px;border:1px solid #334155;text-align:center;">ขอรับรองว่าเป็นความจริง</td>
          </tr>
        </tbody>
      </table>

      <div class="keep-together" style="display:grid;grid-template-columns:1.35fr 1fr;gap:16px;align-items:start;margin-bottom:10px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;">เสียหายทั้งหมดบริจาค ${req.fullDamageCases} รายๆละ ${Number(req.fullDamageRate).toLocaleString('th-TH')} บาท</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;width:100px;">${formatCurrency(fullAmt)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;">เสียหายบางส่วนบริจาค ${req.partialDamageCases} รายๆละ ${Number(req.partialDamageRate).toLocaleString('th-TH')} บาท</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(partialAmt)}</td>
          </tr>
          ${
            (req.deceasedCases || 0) > 0
              ? `<tr>
                  <td style="padding:4px 8px;border:1px solid #cbd5e1;">กรณีเสียชีวิตบริจาค ${req.deceasedCases} รายๆละ ${Number(req.deceasedRate || 0).toLocaleString('th-TH')} บาท</td>
                  <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(deadAmt)}</td>
                </tr>`
              : ''
          }
          <tr>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;">บริจาคเป็นข้าวสารรายละ ${req.riceBagsPerCase} ถุง จำนวน ${req.riceBagTotal} ถุงๆละ ${Number(req.riceBagPrice).toLocaleString('th-TH')} บาท</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(riceAmt)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;">น้ำตราสิงห์รายละ ${req.waterPacksPerCase} แพค จำนวน ${req.waterPackTotal} แพคๆละ ${Number(req.waterPackPrice).toLocaleString('th-TH')} บาท</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(waterAmt)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;">ผ้าห่มรายละ ${req.blanketsPerCase} ผืน จำนวน ${req.blanketTotal} ผืนๆละ ${Number(req.blanketPrice).toLocaleString('th-TH')} บาท</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(blanketAmt)}</td>
          </tr>
          ${
            extraAmt > 0 || req.extraReliefNote
              ? `<tr>
                  <td style="padding:4px 8px;border:1px solid #cbd5e1;">${escapeHtml(req.extraReliefNote || 'รายการช่วยเหลือเพิ่มเติม')}</td>
                  <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(extraAmt)}</td>
                </tr>`
              : ''
          }
          <tr style="background:#f8fafc;font-weight:700;">
            <td style="padding:5px 8px;border:1px solid #334155;text-align:right;">มูลค่ารวม (บาท)</td>
            <td style="padding:5px 8px;border:1px solid #334155;text-align:right;">${formatCurrency(req.totalValue)}</td>
          </tr>
          <tr style="background:#f1f5f9;font-weight:700;">
            <td style="padding:5px 8px;border:1px solid #334155;text-align:right;">เบิกเงินสด (บาท)</td>
            <td style="padding:5px 8px;border:1px solid #334155;text-align:right;">${formatCurrency(req.cashDisbursed)}</td>
          </tr>
        </table>

        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;text-align:center;">
          <div style="font-size:12px;font-weight:600;color:#334155;">ขอรับรองว่าเป็นความจริง</div>
          ${sigImgHtml}
          <div style="font-size:12.5px;font-weight:600;color:#0f172a;">(${escapeHtml(req.approverSignature?.signerName || 'นางสาวศาตพร ภูมิโคกรักษ์')})</div>
          <div style="font-size:11.5px;color:#475569;">${escapeHtml(req.approverSignature?.signerPosition || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ')}</div>
          <div style="font-size:11.5px;color:#334155;margin-top:4px;">ลงวันที่ ${escapeHtml(certDateText)}</div>
          ${shaHtml}
        </div>
      </div>

      <div class="keep-together" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:11.5px;border-top:1px solid #cbd5e1;padding-top:8px;">
        <div>
          <div style="font-weight:700;color:#0f2744;margin-bottom:2px;">หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียหาย</div>
          ${FIRE_RELIEF_DAMAGED_NOTES.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
        <div>
          <div style="font-weight:700;color:#0f2744;margin-bottom:2px;">หมายเหตุ : หลักฐานขอรับการสงเคราะห์ กรณีเสียชีวิต</div>
          ${FIRE_RELIEF_DECEASED_NOTES.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      </div>
      ${
        req.notes
          ? `<div style="margin-top:6px;font-size:11.5px;color:#334155;"><strong>บันทึกเพิ่มเติม:</strong> ${escapeHtml(req.notes)}</div>`
          : ''
      }
    `;
  };

  const handlePrintPdf = (req: FireReliefRequest) => {
    const html = buildFormHtml(req);
    openPrintPreview(`แบบ อค.02 อนุเคราะห์ผู้ประสบเหตุเพลิงไหม้ (${req.docNumber})`, `form_or_kor_02_${req.docNumber}`, html);
  };

  const handleDownloadDoc = (req: FireReliefRequest) => {
    const html = buildFormHtml(req);
    exportToGoogleDocsFile(
      `แบบ อค.02 ${req.docNumber}`,
      html,
      `แบบ_อค.02_${req.docNumber.replace(/[^\w\u0E00-\u0E7F-]/g, '_')}`
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
            บันทึกรายชื่อผู้ประสบภัย คำนวณเงินสงเคราะห์และสิ่งของบรรเทาทุกข์ รองรับดาวน์โหลด Excel (.xlsx), Word/Docs (.doc) และสั่งพิมพ์ PDF (A4)
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
                          {formatThaiDate(req.incidentDate)}
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
                            onClick={() => handlePrintPdf(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                            title="สั่งพิมพ์ / PDF (A4)"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between">
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

            <form onSubmit={handleSubmit} className="p-5 space-y-6">
              {/* Section 1: Incident Info */}
              <div className="space-y-4">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 1 · ข้อมูลเหตุเพลิงไหม้ (หัวแบบ อค.02)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่เกิดเหตุ
                    </label>
                    <input
                      type="date"
                      required
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
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
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ลงวันที่รับรอง
                    </label>
                    <input
                      type="date"
                      value={certifiedDate}
                      onChange={(e) => setCertifiedDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
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
