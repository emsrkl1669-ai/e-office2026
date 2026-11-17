import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  PenTool,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { DEFAULT_PAVILION_ATTACHMENTS, ORG_ID, PAVILION_RULES } from '../data/seedData';
import {
  ElectronicSignature,
  PavilionAttachment,
  PavilionRequest,
  PavilionScheduleRow,
} from '../types/eoffice';
import { escapeHtml, renderOfficialHeaderHtml, renderSignatureBlockHtml } from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

const SIGNAGE_CHOICES = [
  'กำหนดการหน้าศาลา(จอมอนิเตอร์)',
  'กำหนดการหน้างาน(ไวท์บอร์ด)',
  'ป้ายผ้า(ทางเข้าปากซอย)',
];

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
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [pavilionName, setPavilionName] = useState('ศาลา 1');
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
  const [otherNotes, setOtherNotes] = useState('');
  const [attachments, setAttachments] = useState<PavilionAttachment[]>(
    DEFAULT_PAVILION_ATTACHMENTS.map((a) => ({ ...a }))
  );
  const [applicantSig, setApplicantSig] = useState<ElectronicSignature | undefined>(undefined);

  // Signature prompt for applicant or manager approval
  const [sigPrompt, setSigPrompt] = useState<{
    mode: 'applicant' | 'approve';
    request?: PavilionRequest;
  } | null>(null);

  const openCreateModal = () => {
    setPavilionName('ศาลา 1');
    setApplicantName('');
    setRelationship('');
    setPhone('');
    const today = new Date().toISOString().slice(0, 10);
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
    setSchedules([{ date: today, time: '18:30', hostName: '' }]);
    setCemeteryLocation('');
    setOtherNotes('');
    setAttachments(DEFAULT_PAVILION_ATTACHMENTS.map((a) => ({ ...a })));
    setApplicantSig(undefined);
    setShowCreate(true);
  };

  const handleAttachmentFile = (key: string, file?: File) => {
    if (!file) return;
    setAttachments((prev) =>
      prev.map((a) =>
        a.key === key ? { ...a, verified: true, fileName: file.name } : a
      )
    );
  };

  const toggleAttachmentCheck = (key: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, verified: !a.verified } : a))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingNums = pavilionRequests.map((p) =>
      p.docNumber.startsWith('ศล-') ? p.docNumber.slice(3) : p.docNumber
    );
    const docNumber = `ศล-${getNextThaiRunningNumber(existingNums)}`;

    const payload: PavilionRequest = {
      id: `pav_${Date.now()}`,
      orgId: ORG_ID,
      docNumber,
      pavilionName,
      applicantName: applicantName.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
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
      schedules: schedules.filter((s) => s.date || s.hostName),
      cemeteryLocation: cemeteryLocation.trim() || undefined,
      otherNotes: otherNotes.trim() || undefined,
      attachments,
      status: 'pending',
      applicantSignature: applicantSig,
      createdBy: currentStaff?.id || 'local',
    };

    await saveRecord('pavilion_requests', payload, true);
    await pushNotification(
      `คำขอใช้ศาลาสวดอภิธรรม ${payload.docNumber}`,
      `${payload.pavilionName} · ผู้เสียชีวิต: ${payload.deceasedName} (ผู้ขอ: ${payload.applicantName})`,
      'pavilion'
    );
    setShowCreate(false);
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
      (r) => `<div style="font-size:11.5px;line-height:1.45;margin-bottom:2px;">${escapeHtml(r)}</div>`
    ).join('');

    const attHtml = (req.attachments || [])
      .map(
        (a) =>
          `<span style="display:inline-block;width:48%;font-size:11.5px;margin-bottom:3px;">${a.verified ? '☑' : '☐'} ${escapeHtml(a.label)} ${a.fileName ? `(${escapeHtml(a.fileName)})` : ''}</span>`
      )
      .join('');

    const scheduleRows = (req.schedules || [])
      .map(
        (s) => `
        <tr>
          <td style="padding:4px 8px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(s.date))}</td>
          <td style="padding:4px 8px;border:1px solid #cbd5e1;">${escapeHtml(s.time)} น.</td>
          <td style="padding:4px 8px;border:1px solid #cbd5e1;">${escapeHtml(s.hostName || '-')}</td>
        </tr>`
      )
      .join('');

    const html = `
      ${renderOfficialHeaderHtml('ใบขออนุญาตใช้ศาลาสวดอภิธรรม', req.docNumber)}
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px;">ข้อปฏิบัติในการขออนุญาตใช้ศาลาสวดอภิธรรม</div>
        ${rulesHtml}
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
        <tr>
          <td style="width:170px;padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ใช้ศาลาที่</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(req.pavilionName)}</td>
          <td style="width:150px;padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ชื่อผู้เสียชีวิต</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(req.deceasedName)} ${req.deceasedAge ? `(อายุ ${escapeHtml(req.deceasedAge)} ปี)` : ''}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ผู้ขอใช้ศาลา</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(req.applicantName)} (${escapeHtml(req.relationship)})</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เบอร์โทรศัพท์</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(req.phone)}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เข้าใช้ศาลา</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(req.checkInDate))} เวลา ${escapeHtml(req.checkInTime || '-')} น.</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ออกวันที่</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(req.checkOutDate))} เวลา ${escapeHtml(req.checkOutTime || '-')} น.</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">รูปแบบพิธีศพ</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">
            ${req.ceremonyType === 'thai' ? 'พิธีศพแบบไทย' : req.ceremonyType === 'chinese' ? 'พิธีศพแบบจีน (กงเต็ก)' : 'พิธีศพผสมไทย-จีน'}
            ${req.lengJoeiColor ? ` · เหล่งโจ๊ยสี${req.lengJoeiColor === 'red' ? 'แดง (100 ปีขึ้นไป)' : 'เงิน'}` : ''}
          </td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ฌาปนกิจ ณ วัด</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(req.cremationTemple || '-')} (${escapeHtml(formatThaiDate(req.cremationDate))} ${escapeHtml(req.cremationTime || '')} น.)</td>
        </tr>
      </table>

      ${
        scheduleRows
          ? `<div style="margin-bottom:12px;">
              <div style="font-size:13px;font-weight:700;margin-bottom:4px;">รายละเอียดกำหนดการสวดอภิธรรมศพ</div>
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:4px 8px;border:1px solid #cbd5e1;">วันที่</th>
                    <th style="padding:4px 8px;border:1px solid #cbd5e1;">เวลา</th>
                    <th style="padding:4px 8px;border:1px solid #cbd5e1;">เจ้าภาพสวดอภิธรรม</th>
                  </tr>
                </thead>
                <tbody>${scheduleRows}</tbody>
              </table>
            </div>`
          : ''
      }

      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px;">หลักฐานเอกสารแนบประกอบคำขอ</div>
        <div>${attHtml}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        ${renderSignatureBlockHtml('ผู้ร้องขอใช้ศาลา', req.applicantSignature, req.applicantName)}
        ${renderSignatureBlockHtml('ผู้อนุญาต', req.approverSignature, 'นางสาวศาตพร ภูมิโคกรักษ์', 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ')}
      </div>
    `;
    openPrintPreview(`ใบขออนุญาตใช้ศาลาสวดอภิธรรม ${req.docNumber}`, `pavilion_${req.docNumber}`, html);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...pavilionRequests]
      .filter(
        (r) =>
          !q ||
          r.docNumber.toLowerCase().includes(q) ||
          r.pavilionName.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.deceasedName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  }, [pavilionRequests, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบขออนุญาตใช้ศาลาสวดอภิธรรม
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกข้อมูลผู้ขอ-ผู้เสียชีวิต กำหนดการสวดอภิธรรม ตรวจสอบเอกสารแนบ 7 รายการ และอนุมัติพร้อมพิมพ์ PDF
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

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่, ศาลา, ชื่อผู้ขอ หรือผู้เสียชีวิต..."
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
              {filtered.map((req) => {
                const verifiedCount = (req.attachments || []).filter((a) => a.verified).length;
                const totalAtt = (req.attachments || []).length;
                return (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                      {req.docNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{req.pavilionName}</div>
                      <div className="text-xs text-slate-600">ผู้วายชนม์: {req.deceasedName}</div>
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
                      <div className="inline-flex items-center gap-1.5">
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
                          <button
                            type="button"
                            onClick={() => setSigPrompt({ mode: 'approve', request: req })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            อนุมัติคำขอ
                          </button>
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
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Pavilion Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                แบบคำขออนุญาตใช้ศาลาสวดอภิธรรมและกำหนดการพิธีศพ
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Rules collapsible summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-1 max-h-36 overflow-y-auto">
                <div className="font-semibold text-slate-800 mb-1">
                  ระเบียบข้อปฏิบัติในการขอใช้ศาลาสวดอภิธรรม (ฟรีไม่มีค่าใช้จ่าย)
                </div>
                {PAVILION_RULES.map((rule) => (
                  <p key={rule}>{rule}</p>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ศาลาที่ขอใช้</label>
                  <select
                    value={pavilionName}
                    onChange={(e) => setPavilionName(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {['ศาลา 1', 'ศาลา 2', 'ศาลา 3', 'ศาลา 4', 'ศาลา 5'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อผู้ขอใช้ศาลา</label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ความสัมพันธ์ผู้เสียชีวิต</label>
                  <input
                    type="text"
                    required
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder="เช่น บุตร / คู่สมรส"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันเข้าใช้ศาลา</label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เวลาเข้าใช้</label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันออก</label>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เวลาออก</label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Deceased & Ceremony */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อ-สกุลผู้เสียชีวิต</label>
                  <input
                    type="text"
                    required
                    value={deceasedName}
                    onChange={(e) => setDeceasedName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">อายุ (ปี) / ชื่อเล่น</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">รูปแบบพิธีศพ</label>
                  <select
                    value={ceremonyType}
                    onChange={(e) => setCeremonyType(e.target.value as PavilionRequest['ceremonyType'])}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="thai">พิธีศพแบบไทย</option>
                    <option value="chinese">พิธีศพแบบจีน (กงเต็ก)</option>
                    <option value="mixed">พิธีศพผสมไทย-จีน</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ฌาปนกิจ ณ วัด</label>
                  <input
                    type="text"
                    value={cremationTemple}
                    onChange={(e) => setCremationTemple(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันฌาปนกิจ</label>
                  <input
                    type="date"
                    value={cremationDate}
                    onChange={(e) => setCremationDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เหล่งโจ๊ย (ผ้าฉาก)</label>
                  <select
                    value={lengJoeiColor}
                    onChange={(e) => setLengJoeiColor(e.target.value as 'silver' | 'red' | '')}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="silver">สีเงิน (อายุไม่ถึง 100 ปี)</option>
                    <option value="red">สีแดง (อายุ 100 ปีขึ้นไป)</option>
                    <option value="">ไม่ใช้</option>
                  </select>
                </div>
              </div>

              {/* 7 Attachments Checklist */}
              <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  เอกสารแนบประกอบคำขอ (7 รายการ)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attachments.map((att) => (
                    <div
                      key={att.key}
                      className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={att.verified}
                          onChange={() => toggleAttachmentCheck(att.key)}
                          className="rounded border-slate-300"
                        />
                        <span>{att.label}</span>
                      </label>
                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-800 bg-white border border-slate-300 rounded cursor-pointer hover:bg-blue-50 shrink-0">
                        <Upload className="w-3 h-3" />
                        <span>{att.fileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์'}</span>
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
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-700">
                  {applicantSig
                    ? `ลงลายเซ็นผู้ขอใช้ศาลาแล้ว (${applicantSig.signerName})`
                    : 'ลายเซ็นผู้ร้องขอใช้ศาลา'}
                </span>
                <button
                  type="button"
                  onClick={() => setSigPrompt({ mode: 'applicant' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  {applicantSig ? 'เซ็นใหม่' : 'ลงลายมือชื่อผู้ขอ'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg"
                >
                  บันทึกคำขอใช้ศาลา
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
        documentRef={sigPrompt?.request?.docNumber || 'PAVILION-NEW'}
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
