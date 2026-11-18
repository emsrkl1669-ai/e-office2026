import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FileCheck2,
  PenTool,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { DEFAULT_PAVILION_ATTACHMENTS, ORG_ID, PAVILION_RULES } from '../data/seedData';
import {
  ElectronicSignature,
  PavilionAttachment,
  PavilionRequest,
  PavilionScheduleRow,
} from '../types/eoffice';
import {
  escapeHtml,
  renderOfficialHeaderHtml,
  renderSignatureBlockHtml,
} from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

const SIGNAGE_CHOICES = [
  'กำหนดการหน้าศาลา(จอมอนิเตอร์)',
  'กำหนดการหน้างาน(ไวท์บอร์ด)',
  'ป้ายผ้า(ทางเข้าปากซอย)',
];

const PAVILION_OPTIONS = ['ศาลา 1', 'ศาลา 2', 'ศาลา 3', 'ศาลา 4', 'ศาลา 5'];

export const PavilionModule: React.FC = () => {
  const {
    pavilionRequests,
    currentStaff,
    canManageRegistry,
    canApproveTier2,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PavilionRequest['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<PavilionRequest | null>(null);

  // Part 1: Permit Fields
  const [pavilionName, setPavilionName] = useState('ศาลา 1');
  const [customPavilion, setCustomPavilion] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutDate, setCheckOutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutTime, setCheckOutTime] = useState('14:00');
  const [cremationTemple, setCremationTemple] = useState('');
  const [cremationDate, setCremationDate] = useState('');
  const [cremationTime, setCremationTime] = useState('16:00');

  // Part 2: Ceremony Details
  const [ceremonyType, setCeremonyType] = useState<'thai' | 'chinese' | 'mixed'>('thai');
  const [lengJoeiColor, setLengJoeiColor] = useState<'silver' | 'red' | ''>('silver');
  const [signageOptions, setSignageOptions] = useState<string[]>([SIGNAGE_CHOICES[0]]);
  const [deceasedName, setDeceasedName] = useState('');
  const [deceasedAge, setDeceasedAge] = useState('');
  const [deceasedNickname, setDeceasedNickname] = useState('');
  const [bathingDate, setBathingDate] = useState('');
  const [schedules, setSchedules] = useState<PavilionScheduleRow[]>([
    { date: '', time: '18:30', hostName: '' },
  ]);
  const [cemeteryLocation, setCemeteryLocation] = useState('');
  const [cemeteryDate, setCemeteryDate] = useState('');
  const [cemeteryTime, setCemeteryTime] = useState('');
  const [otherNotes, setOtherNotes] = useState('');

  // Attachments & Signatures
  const [attachments, setAttachments] = useState<PavilionAttachment[]>(
    DEFAULT_PAVILION_ATTACHMENTS.map((a) => ({ ...a }))
  );
  const [applicantSig, setApplicantSig] = useState<ElectronicSignature | undefined>(undefined);

  const [sigPrompt, setSigPrompt] = useState<{
    mode: 'applicant' | 'approve';
    request?: PavilionRequest;
  } | null>(null);

  const openCreateModal = () => {
    setEditingReq(null);
    const today = new Date().toISOString().slice(0, 10);
    setPavilionName('ศาลา 1');
    setCustomPavilion('');
    setApplicantName('');
    setRelationship('');
    setPhone('');
    setCheckInDate(today);
    setCheckInTime('15:00');
    setCheckOutDate(today);
    setCheckOutTime('14:00');
    setCremationTemple('');
    setCremationDate('');
    setCremationTime('16:00');
    setCeremonyType('thai');
    setLengJoeiColor('silver');
    setSignageOptions([SIGNAGE_CHOICES[0]]);
    setDeceasedName('');
    setDeceasedAge('');
    setDeceasedNickname('');
    setBathingDate(today);
    setSchedules([
      { date: today, time: '18:30', hostName: '' },
      { date: '', time: '18:30', hostName: '' },
      { date: '', time: '18:30', hostName: '' },
    ]);
    setCemeteryLocation('');
    setCemeteryDate('');
    setCemeteryTime('');
    setOtherNotes('');
    setAttachments(DEFAULT_PAVILION_ATTACHMENTS.map((a) => ({ ...a })));
    setApplicantSig(undefined);
    setShowModal(true);
  };

  const openEditModal = (req: PavilionRequest) => {
    setEditingReq(req);
    const isStandard = PAVILION_OPTIONS.includes(req.pavilionName);
    setPavilionName(isStandard ? req.pavilionName : '__CUSTOM__');
    setCustomPavilion(isStandard ? '' : req.pavilionName);
    setApplicantName(req.applicantName);
    setRelationship(req.relationship);
    setPhone(req.phone);
    setCheckInDate(req.checkInDate);
    setCheckInTime(req.checkInTime || '15:00');
    setCheckOutDate(req.checkOutDate);
    setCheckOutTime(req.checkOutTime || '14:00');
    setCremationTemple(req.cremationTemple || '');
    setCremationDate(req.cremationDate || '');
    setCremationTime(req.cremationTime || '16:00');
    setCeremonyType(req.ceremonyType || 'thai');
    setLengJoeiColor(req.lengJoeiColor || '');
    setSignageOptions(req.signageOptions || []);
    setDeceasedName(req.deceasedName);
    setDeceasedAge(req.deceasedAge || '');
    setDeceasedNickname(req.deceasedNickname || '');
    setBathingDate(req.bathingDate || '');
    setSchedules(
      req.schedules && req.schedules.length > 0
        ? req.schedules.map((s) => ({ ...s }))
        : [{ date: req.checkInDate, time: '18:30', hostName: '' }]
    );
    setCemeteryLocation(req.cemeteryLocation || '');
    setCemeteryDate(req.cemeteryDate || '');
    setCemeteryTime(req.cemeteryTime || '');
    setOtherNotes(req.otherNotes || '');
    setAttachments(
      req.attachments && req.attachments.length > 0
        ? req.attachments.map((a) => ({ ...a }))
        : DEFAULT_PAVILION_ATTACHMENTS.map((a) => ({ ...a }))
    );
    setApplicantSig(req.applicantSignature);
    setShowModal(true);
  };

  const toggleSignage = (label: string) => {
    setSignageOptions((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const updateScheduleRow = (
    idx: number,
    field: keyof PavilionScheduleRow,
    val: string
  ) => {
    setSchedules((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const addScheduleRow = () => {
    if (schedules.length >= 10) return;
    setSchedules((prev) => [...prev, { date: '', time: '18:30', hostName: '' }]);
  };

  const removeScheduleRow = (idx: number) => {
    setSchedules((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
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

  const toggleAttachmentCheck = (key: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, verified: !a.verified } : a))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedPavilion =
      pavilionName === '__CUSTOM__'
        ? customPavilion.trim() || 'ศาลา'
        : pavilionName;

    const existingNums = pavilionRequests.map((p) =>
      p.docNumber.startsWith('ศล-') ? p.docNumber.slice(3) : p.docNumber
    );
    const docNumber = editingReq
      ? editingReq.docNumber
      : `ศล-${getNextThaiRunningNumber(existingNums)}`;

    const cleanSchedules = schedules.filter(
      (s) => s.date.trim() || s.hostName.trim()
    );

    const payload: PavilionRequest = {
      id: editingReq ? editingReq.id : `pav_${Date.now()}`,
      orgId: ORG_ID,
      docNumber,
      pavilionName: resolvedPavilion,
      applicantName: applicantName.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      checkInDate,
      checkInTime: checkInTime || undefined,
      checkOutDate,
      checkOutTime: checkOutTime || undefined,
      cremationTemple: cremationTemple.trim() || undefined,
      cremationDate: cremationDate || undefined,
      cremationTime: cremationTime || undefined,
      ceremonyType,
      lengJoeiColor: lengJoeiColor || undefined,
      signageOptions,
      deceasedName: deceasedName.trim(),
      deceasedAge: deceasedAge.trim() || undefined,
      deceasedNickname: deceasedNickname.trim() || undefined,
      bathingDate: bathingDate || undefined,
      schedules: cleanSchedules,
      cemeteryLocation: cemeteryLocation.trim() || undefined,
      cemeteryDate: cemeteryDate || undefined,
      cemeteryTime: cemeteryTime || undefined,
      otherNotes: otherNotes.trim() || undefined,
      attachments,
      status: editingReq ? editingReq.status : 'pending',
      applicantSignature: applicantSig,
      approverSignature: editingReq?.approverSignature,
      createdBy: editingReq?.createdBy || currentStaff?.id || 'local',
      createdAt: editingReq?.createdAt,
    };

    await saveRecord('pavilion_requests', payload, !editingReq);
    await pushNotification(
      editingReq
        ? `แก้ไขรายละเอียดคำขอศาลา ${payload.docNumber}`
        : `คำขอใช้ศาลาสวดอภิธรรม ${payload.docNumber}`,
      `${payload.pavilionName} · ผู้เสียชีวิต: ${payload.deceasedName} (ผู้ขอ: ${payload.applicantName})`,
      'pavilion'
    );
    setShowModal(false);
  };

  const handleVerifyDocs = async (req: PavilionRequest) => {
    const updated: PavilionRequest = {
      ...req,
      status: 'verified',
      attachments: (req.attachments || []).map((a) => ({ ...a, verified: true })),
    };
    await saveRecord('pavilion_requests', updated, false);
    await pushNotification(
      `ตรวจสอบเอกสารคำขอศาลา ${req.docNumber} แล้ว`,
      `${req.pavilionName} · รอผู้จัดการมูลนิธิฯ อนุมัติ`,
      'pavilion'
    );
  };

  const handleRejectRequest = async (req: PavilionRequest) => {
    const updated: PavilionRequest = {
      ...req,
      status: 'rejected',
    };
    await saveRecord('pavilion_requests', updated, false);
    await pushNotification(
      `ไม่อนุมัติคำขอใช้ศาลา ${req.docNumber}`,
      `${req.pavilionName} · ${req.applicantName}`,
      'pavilion'
    );
  };

  const handleApproveWithSignature = async (
    req: PavilionRequest,
    sig: ElectronicSignature
  ) => {
    const updated: PavilionRequest = {
      ...req,
      status: 'approved',
      approverSignature: sig,
    };
    await saveRecord('pavilion_requests', updated, false);
    await pushNotification(
      `อนุมัติใช้${req.pavilionName} (${req.docNumber})`,
      `ผู้จัดการมูลนิธิฯ อนุมัติคำขอของ ${req.applicantName} แล้ว`,
      'pavilion'
    );
  };

  const printPavilionPermit = (req: PavilionRequest) => {
    const rulesHtml = PAVILION_RULES.map(
      (r) =>
        `<div style="font-size:11.5px;line-height:1.48;margin-bottom:2px;">${escapeHtml(r)}</div>`
    ).join('');

    const attHtml = (req.attachments || [])
      .map(
        (a) =>
          `<span style="display:inline-block;width:48%;font-size:11.5px;margin-bottom:3px;">${a.verified ? '☑' : '☐'} ${escapeHtml(a.label)}${a.fileName ? ` (${escapeHtml(a.fileName)})` : ''}</span>`
      )
      .join('');

    const filledSchedules = req.schedules || [];
    const displayScheduleRows = Array.from({ length: Math.max(7, filledSchedules.length) }).map(
      (_, i) => filledSchedules[i] || { date: '', time: '', hostName: '' }
    );

    const scheduleRowPad = displayScheduleRows.length > 8 ? '4px 8px' : '5px 8px';
    const scheduleRowsHtml = displayScheduleRows
      .map(
        (s) => `
        <tr>
          <td style="padding:${scheduleRowPad};border:1px solid #cbd5e1;width:28%;">${s.date ? escapeHtml(formatThaiDate(s.date)) : '&nbsp;'}</td>
          <td style="padding:${scheduleRowPad};border:1px solid #cbd5e1;width:18%;text-align:center;">${s.time ? `${escapeHtml(s.time)} น.` : '&nbsp;'}</td>
          <td style="padding:${scheduleRowPad};border:1px solid #cbd5e1;">${s.hostName ? escapeHtml(s.hostName) : '&nbsp;'}</td>
        </tr>`
      )
      .join('');

    const checkBox = (checked: boolean, label: string) =>
      `<span style="margin-right:14px;">${checked ? '☑' : '☐'} ${escapeHtml(label)}</span>`;

    const applicantSignedDate = req.applicantSignature?.signedAt
      ? formatThaiDate(req.applicantSignature.signedAt)
      : '................................';
    const approverSignedDate = req.approverSignature?.signedAt
      ? formatThaiDate(req.approverSignature.signedAt)
      : '................................';

    const html = `
      <!-- หน้า 1: ใบขออนุญาตใช้ศาลาสวดอภิธรรม -->
      ${renderOfficialHeaderHtml('ใบขออนุญาตใช้ศาลาสวดอภิธรรม', req.docNumber)}

      <div class="keep-together" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:9px 12px;margin-bottom:10px;">
        <div style="font-size:12.5px;font-weight:700;margin-bottom:4px;">ข้อปฏิบัติในการขออนุญาตใช้ศาลาสวดอภิธรรม</div>
        ${rulesHtml}
      </div>

      <table class="keep-together" style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:12px;">
        <tr>
          <td style="width:180px;padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ใช้ศาลาที่</td>
          <td colspan="3" style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(req.pavilionName)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ชื่อผู้ขอใช้ศาลา</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.applicantName)}</td>
          <td style="width:165px;padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ความสัมพันธ์กับผู้เสียชีวิต</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.relationship)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เบอร์โทรศัพท์</td>
          <td colspan="3" style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.phone)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เข้าใช้ศาลาวันที่</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(req.checkInDate))}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เวลา</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.checkInTime || '-')} น.</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ออกวันที่</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(req.checkOutDate))}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เวลา</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.checkOutTime || '-')} น.</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ฌาปนกิจที่วัด</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.cremationTemple || '-')}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เวลา</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.cremationTime || '-')} น.</td>
        </tr>
      </table>

      <div class="keep-together" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          ${renderSignatureBlockHtml('ผู้ร้องขอใช้ศาลา', req.applicantSignature, req.applicantName)}
          <div style="text-align:center;font-size:12px;color:#475569;margin-top:4px;">ลงวันที่ ${escapeHtml(applicantSignedDate)}</div>
        </div>
        <div>
          ${renderSignatureBlockHtml('ผู้อนุญาต', req.approverSignature, 'นางสาวศาตพร ภูมิโคกรักษ์', 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ')}
          <div style="text-align:center;font-size:12px;color:#475569;margin-top:4px;">ลงวันที่ ${escapeHtml(approverSignedDate)}</div>
        </div>
      </div>

      <!-- A4_PAGE_BREAK -->

      <!-- หน้า 2: รายการสวดอภิธรรมศพ / รายละเอียดพิธีงานศพ -->
      <div>
        ${renderOfficialHeaderHtml('รายการสวดอภิธรรมศพ / รายละเอียดพิธีงานศพ', `${req.docNumber} · ${req.pavilionName}`)}

        <div class="keep-together" style="border:1px solid #cbd5e1;border-radius:6px;padding:9px 12px;font-size:12.5px;line-height:1.78;margin-bottom:10px;">
          <div>
            <strong>รูปแบบพิธีศพ:</strong>&nbsp;
            ${checkBox(req.ceremonyType === 'thai', 'พิธีศพแบบไทย')}
            ${checkBox(req.ceremonyType === 'chinese', 'พิธีศพแบบจีน(ทำพิธีกงเต็ก)')}
            ${checkBox(req.ceremonyType === 'mixed', 'พิธีศพผสมทั้งไทยและจีน')}
          </div>
          <div>
            <strong>เหล่งโจ๊ย(ผ้าฉาก):</strong>&nbsp;
            ${checkBox(req.lengJoeiColor === 'red', 'สีแดง(อายุ 100 ปีขึ้นไป)')}
            ${checkBox(req.lengJoeiColor === 'silver', 'สีเงิน(อายุไม่ถึง 100 ปี)')}
          </div>
          <div>
            <strong>ป้ายกำหนดการ:</strong>&nbsp;
            ${SIGNAGE_CHOICES.map((opt) =>
              checkBox((req.signageOptions || []).includes(opt), opt)
            ).join('')}
          </div>
          <div style="margin-top:5px;border-top:1px dashed #cbd5e1;padding-top:5px;">
            <strong>ชื่อ-สกุลผู้เสียชีวิต:</strong> ${escapeHtml(req.deceasedName)}
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <strong>อายุ:</strong> ${escapeHtml(req.deceasedAge || '-')} ปี
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <strong>ชื่อเล่น(ถ้ามี):</strong> ${escapeHtml(req.deceasedNickname || '-')}
          </div>
          <div>
            <strong>วันรดน้ำศพ:</strong> ${req.bathingDate ? escapeHtml(formatThaiDate(req.bathingDate)) : '-'}
          </div>
        </div>

        <div class="keep-together" style="margin-bottom:10px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:4px;">รายละเอียดในการกำหนดสวดอภิธรรมศพและพิธีกงเต็กดังนี้</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:5px 8px;border:1px solid #cbd5e1;">วันที่</th>
                <th style="padding:5px 8px;border:1px solid #cbd5e1;">เวลา</th>
                <th style="padding:5px 8px;border:1px solid #cbd5e1;">เจ้าภาพสวดอภิธรรม</th>
              </tr>
            </thead>
            <tbody>${scheduleRowsHtml}</tbody>
          </table>
        </div>

        <table class="keep-together" style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px;">
          <tr>
            <td style="width:155px;padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ฌาปนกิจ ณ วัด</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.cremationTemple || '........................................')}</td>
            <td style="width:235px;padding:6px 10px;border:1px solid #cbd5e1;">
              วันที่ ${req.cremationDate ? escapeHtml(formatThaiDate(req.cremationDate)) : '................'} เวลา ${escapeHtml(req.cremationTime || '.......')} น.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เคลื่อนศพไปสุสาน</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">ณ จ. ${escapeHtml(req.cemeteryLocation || '........................................')}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">
              วันที่ ${req.cemeteryDate ? escapeHtml(formatThaiDate(req.cemeteryDate)) : '................'} เวลา ${escapeHtml(req.cemeteryTime || '.......')} น.
            </td>
          </tr>
          <tr>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">อื่นๆ</td>
            <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;">${escapeHtml(req.otherNotes || '-')}</td>
          </tr>
        </table>

        <div class="keep-together" style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;">
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">หลักฐานเอกสารแนบประกอบคำขอ (7 รายการ)</div>
          <div>${attHtml}</div>
        </div>
      </div>
    `;
    openPrintPreview(`ใบขออนุญาตใช้ศาลาสวดอภิธรรม ${req.docNumber}`, `pavilion_${req.docNumber}`, html);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...pavilionRequests]
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (!q) return true;
        return (
          r.docNumber.toLowerCase().includes(q) ||
          r.pavilionName.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.deceasedName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  }, [pavilionRequests, searchTerm, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบขออนุญาตใช้ศาลาสวดอภิธรรม
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แบบฟอร์มใบขออนุญาตใช้ศาลา รายการสวดอภิธรรมศพ/รายละเอียดพิธีงานศพ ตรวจสอบเอกสาร 7 รายการ และอนุมัติพร้อมพิมพ์ PDF
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          ยื่นคำขอใช้ศาลาใหม่
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              ['all', 'ทั้งหมด'],
              ['pending', 'รอตรวจเอกสาร'],
              ['verified', 'ตรวจเอกสารแล้ว'],
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
            placeholder="ค้นหาเลขที่, ศาลา, ผู้ขอ, ผู้เสียชีวิต..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">เลขที่</th>
                <th className="py-3 px-4">ศาลา / ผู้เสียชีวิต</th>
                <th className="py-3 px-4">ผู้ขอใช้ศาลา</th>
                <th className="py-3 px-4">เข้าใช้ – ออก / ฌาปนกิจ</th>
                <th className="py-3 px-4">เอกสาร / สถานะ</th>
                <th className="py-3 px-4 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    ไม่พบรายการคำขอใช้ศาลา
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const verifiedCount = (req.attachments || []).filter((a) => a.verified).length;
                  const totalAtt = (req.attachments || []).length;
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
                        <div className="font-semibold text-slate-900">{req.pavilionName}</div>
                        <div className="text-xs text-slate-600">
                          ผู้วายชนม์: {req.deceasedName}
                          {req.deceasedAge ? ` (${req.deceasedAge} ปี)` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {req.ceremonyType === 'thai'
                            ? 'พิธีไทย'
                            : req.ceremonyType === 'chinese'
                              ? 'พิธีจีน (กงเต็ก)'
                              : 'ผสมไทย-จีน'}{' '}
                          · สวด {req.schedules?.length || 0} คืน
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-900">{req.applicantName}</div>
                        <div className="text-slate-500">
                          {req.relationship} · {req.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>
                          {formatThaiDate(req.checkInDate)} – {formatThaiDate(req.checkOutDate)}
                        </div>
                        {req.cremationDate && (
                          <div className="text-slate-500">
                            ฌาปนกิจ: {formatThaiDate(req.cremationDate)} ({req.cremationTemple || '-'})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <div className="text-slate-500 tabular-nums">
                          เอกสารแนบ {verifiedCount}/{totalAtt}
                        </div>
                        <div
                          className={`font-medium mt-0.5 ${
                            req.status === 'approved'
                              ? 'text-emerald-700'
                              : req.status === 'verified'
                                ? 'text-blue-800'
                                : req.status === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                          }`}
                        >
                          {req.status === 'approved'
                            ? 'อนุมัติแล้ว'
                            : req.status === 'verified'
                              ? 'ตรวจเอกสารแล้ว (รออนุมัติ)'
                              : req.status === 'rejected'
                                ? 'ไม่อนุมัติ'
                                : 'รอตรวจสอบเอกสาร'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(req)}
                              className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                              title="แก้ไขรายละเอียดแบบฟอร์ม"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {req.status === 'pending' && canManageRegistry && (
                            <button
                              type="button"
                              onClick={() => handleVerifyDocs(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              ตรวจเอกสาร
                            </button>
                          )}
                          {req.status !== 'approved' && req.status !== 'rejected' && canApproveTier2 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSigPrompt({ mode: 'approve', request: req })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                อนุมัติ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectRequest(req)}
                                className="p-2 text-red-700 hover:bg-red-50 rounded-lg"
                                title="ไม่อนุมัติ"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => printPavilionPermit(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            ใบอนุญาต PDF
                          </button>
                          {currentStaff?.role === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => removeRecord('pavilion_requests', req.id)}
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

      {/* Create / Edit Pavilion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {editingReq
                    ? `แก้ไขคำขอใช้ศาลาสวดอภิธรรม (${editingReq.docNumber})`
                    : 'แบบฟอร์มใบขออนุญาตใช้ศาลาสวดอภิธรรมและรายละเอียดพิธีงานศพ'}
                </h3>
                <p className="text-xs text-slate-500">
                  มูลนิธิร่วมกุศลสมุทรปราการ · ฟรีไม่มีค่าใช้จ่าย (มีบริการรับศพฟรี-บริการโลงฟรี)
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
              {/* 12 Rules */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-1 max-h-40 overflow-y-auto">
                <div className="font-semibold text-slate-900 mb-1">
                  ข้อปฏิบัติในการขออนุญาตใช้ศาลาสวดอภิธรรม (12 ข้อ)
                </div>
                {PAVILION_RULES.map((rule) => (
                  <p key={rule}>{rule}</p>
                ))}
              </div>

              {/* Section 1: Permit Details */}
              <div className="space-y-4">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 1 · ข้อมูลใบขออนุญาตใช้ศาลาสวดอภิธรรม
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ใช้ศาลาที่
                    </label>
                    <select
                      value={pavilionName}
                      onChange={(e) => setPavilionName(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {PAVILION_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="__CUSTOM__">ระบุศาลาอื่น...</option>
                    </select>
                    {pavilionName === '__CUSTOM__' && (
                      <input
                        type="text"
                        required
                        value={customPavilion}
                        onChange={(e) => setCustomPavilion(e.target.value)}
                        placeholder="ระบุชื่อศาลา"
                        className="mt-2 w-full h-9 px-3 text-sm border border-slate-300 rounded-lg"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ชื่อผู้ขอใช้ศาลา
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ความสัมพันธ์กับผู้เสียชีวิต
                    </label>
                    <input
                      type="text"
                      required
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      placeholder="เช่น บุตร / คู่สมรส / ญาติ"
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เข้าใช้ศาลาวันที่
                    </label>
                    <input
                      type="date"
                      required
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เวลาเข้าใช้ (น.)
                    </label>
                    <input
                      type="time"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ออกวันที่
                    </label>
                    <input
                      type="date"
                      required
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เวลาออก (น.)
                    </label>
                    <input
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Ceremony & Schedule Details */}
              <div className="space-y-4">
                <h4 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                  ส่วนที่ 2 · รายการสวดอภิธรรมศพ / รายละเอียดพิธีงานศพ
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      รูปแบบพิธีศพ
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['thai', 'พิธีศพแบบไทย'],
                          ['chinese', 'พิธีศพแบบจีน(ทำพิธีกงเต็ก)'],
                          ['mixed', 'พิธีศพผสมทั้งไทยและจีน'],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCeremonyType(val)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            ceremonyType === val
                              ? 'bg-[#0F2744] text-white border-[#0F2744]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      เหล่งโจ๊ย (ผ้าฉาก)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['red', 'สีแดง (อายุ 100 ปีขึ้นไป)'],
                          ['silver', 'สีเงิน (อายุไม่ถึง 100 ปี)'],
                          ['', 'ไม่ระบุ / ไม่ใช้'],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val || 'none'}
                          type="button"
                          onClick={() => setLengJoeiColor(val)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            lengJoeiColor === val
                              ? 'bg-[#0F2744] text-white border-[#0F2744]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    ป้ายกำหนดการที่ต้องการจัดทำ
                  </label>
                  <div className="flex flex-wrap gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {SIGNAGE_CHOICES.map((opt) => (
                      <label
                        key={opt}
                        className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={signageOptions.includes(opt)}
                          onChange={() => toggleSignage(opt)}
                          className="rounded border-slate-300"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ชื่อ-สกุลผู้เสียชีวิต
                    </label>
                    <input
                      type="text"
                      required
                      value={deceasedName}
                      onChange={(e) => setDeceasedName(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      อายุ (ปี) / ชื่อเล่น(ถ้ามี)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={deceasedAge}
                        onChange={(e) => setDeceasedAge(e.target.value)}
                        placeholder="อายุ"
                        className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={deceasedNickname}
                        onChange={(e) => setDeceasedNickname(e.target.value)}
                        placeholder="ชื่อเล่น"
                        className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันรดน้ำศพ
                    </label>
                    <input
                      type="date"
                      value={bathingDate}
                      onChange={(e) => setBathingDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Schedule Rows (up to 10 nights) */}
                <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      รายละเอียดในการกำหนดสวดอภิธรรมศพและพิธีกงเต็ก (สูงสุด 10 คืน)
                    </span>
                    <button
                      type="button"
                      disabled={schedules.length >= 10}
                      onClick={addScheduleRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มคืนสวด
                    </button>
                  </div>
                  <div className="space-y-2">
                    {schedules.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 sm:col-span-4">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateScheduleRow(idx, 'date', e.target.value)}
                            className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="time"
                            value={row.time}
                            onChange={(e) => updateScheduleRow(idx, 'time', e.target.value)}
                            className="w-full h-9 px-2 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-5">
                          <input
                            type="text"
                            value={row.hostName}
                            onChange={(e) => updateScheduleRow(idx, 'hostName', e.target.value)}
                            placeholder={`เจ้าภาพสวดอภิธรรม คืนที่ ${idx + 1}`}
                            className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeScheduleRow(idx)}
                            disabled={schedules.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-red-700 disabled:opacity-30"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cremation & Cemetery */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ฌาปนกิจ ณ วัด
                    </label>
                    <input
                      type="text"
                      value={cremationTemple}
                      onChange={(e) => setCremationTemple(e.target.value)}
                      placeholder="ชื่อวัด"
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่ฌาปนกิจ
                    </label>
                    <input
                      type="date"
                      value={cremationDate}
                      onChange={(e) => setCremationDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เวลาฌาปนกิจ (น.)
                    </label>
                    <input
                      type="time"
                      value={cremationTime}
                      onChange={(e) => setCremationTime(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เคลื่อนศพไปสุสาน ณ จังหวัด
                    </label>
                    <input
                      type="text"
                      value={cemeteryLocation}
                      onChange={(e) => setCemeteryLocation(e.target.value)}
                      placeholder="เช่น ชลบุรี / สระบุรี (ถ้ามี)"
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่เคลื่อนศพไปสุสาน
                    </label>
                    <input
                      type="date"
                      value={cemeteryDate}
                      onChange={(e) => setCemeteryDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เวลาเคลื่อนศพ (น.)
                    </label>
                    <input
                      type="time"
                      value={cemeteryTime}
                      onChange={(e) => setCemeteryTime(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    อื่นๆ / หมายเหตุเพิ่มเติม
                  </label>
                  <textarea
                    rows={2}
                    value={otherNotes}
                    onChange={(e) => setOtherNotes(e.target.value)}
                    placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 7 Attachments Checklist */}
              <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  ส่วนที่ 3 · เอกสารแนบประกอบคำขอ (7 รายการ)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attachments.map((att) => (
                    <div
                      key={att.key}
                      className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={att.verified}
                          onChange={() => toggleAttachmentCheck(att.key)}
                          className="rounded border-slate-300 shrink-0"
                        />
                        <span className="truncate">
                          {att.label}
                          {att.fileName ? ` (${att.fileName})` : ''}
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-800 bg-white border border-slate-300 rounded cursor-pointer hover:bg-blue-50 shrink-0">
                        <Upload className="w-3 h-3" />
                        <span>{att.fileName ? 'เปลี่ยน' : 'แนบไฟล์'}</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => handleAttachmentFile(att.key, e.target.files?.[0])}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applicant Signature */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    ลายเซ็นผู้ร้องขอใช้ศาลา
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {applicantSig
                      ? `ลงนามแล้วโดย ${applicantSig.signerName} · SHA-256: ${applicantSig.sha256.slice(0, 14)}...`
                      : 'ลงลายมือชื่อผู้ขอใช้ศาลาด้วยเมาส์/นิ้ว หรืออัปโหลด'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {applicantSig && (
                    <img
                      src={applicantSig.dataUrl}
                      alt="ลายเซ็นผู้ขอใช้ศาลา"
                      className="h-10 border border-slate-200 rounded bg-white px-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSigPrompt({ mode: 'applicant' })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {applicantSig ? 'เซ็นใหม่' : 'ลงลายมือชื่อผู้ขอ'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C]"
                >
                  {editingReq ? 'บันทึกการแก้ไข' : 'บันทึกคำขอใช้ศาลา'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SignaturePadModal
        open={Boolean(sigPrompt)}
        title={
          sigPrompt?.mode === 'approve'
            ? 'ลงนามผู้อนุญาตใช้ศาลาสวดอภิธรรม'
            : 'ลงนามผู้ร้องขอใช้ศาลาสวดอภิธรรม'
        }
        signerName={
          sigPrompt?.mode === 'approve'
            ? currentStaff?.fullName || ''
            : applicantName || currentStaff?.fullName || ''
        }
        signerPosition={
          sigPrompt?.mode === 'approve'
            ? currentStaff?.position || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ'
            : 'ผู้ร้องขอใช้ศาลา'
        }
        documentRef={sigPrompt?.request?.docNumber || editingReq?.docNumber || 'PAVILION-NEW'}
        onClose={() => setSigPrompt(null)}
        onConfirm={(sig) => {
          if (sigPrompt?.mode === 'applicant') {
            setApplicantSig(sig);
          } else if (sigPrompt?.mode === 'approve' && sigPrompt.request) {
            handleApproveWithSignature(sigPrompt.request, sig);
          }
        }}
      />
    </div>
  );
};
