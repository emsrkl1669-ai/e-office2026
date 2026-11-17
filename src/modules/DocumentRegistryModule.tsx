import React, { useMemo, useState } from 'react';
import { Download, FileText, Plus, Printer, Search, Trash2, Upload, X } from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ORG_ID } from '../data/seedData';
import { RegistryDocument } from '../types/eoffice';
import { escapeHtml, renderOfficialHeaderHtml } from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';

interface DocumentRegistryModuleProps {
  mode: 'incoming' | 'outgoing';
}

export const DocumentRegistryModule: React.FC<DocumentRegistryModuleProps> = ({ mode }) => {
  const {
    incomingDocs,
    outgoingDocs,
    currentStaff,
    canDeleteRegistry,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const isIncoming = mode === 'incoming';
  const docs = isIncoming ? incomingDocs : outgoingDocs;
  const collectionName = isIncoming ? 'incoming_docs' : 'outgoing_docs';
  const title = isIncoming ? 'ระบบทะเบียนหนังสือรับ' : 'ระบบทะเบียนหนังสือส่ง';
  const prefix = isIncoming ? 'รับ-' : 'รก.สป. ';

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromOrg, setFromOrg] = useState(isIncoming ? '' : 'มูลนิธิร่วมกุศลสมุทรปราการ');
  const [toOrg, setToOrg] = useState(isIncoming ? 'มูลนิธิร่วมกุศลสมุทรปราการ' : '');
  const [subject, setSubject] = useState('');
  const [handlerName, setHandlerName] = useState(currentStaff?.fullName || '');
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentData, setAttachmentData] = useState('');

  const openCreateModal = () => {
    const existingNums = docs.map((d) =>
      d.docNumber.startsWith(prefix) ? d.docNumber.slice(prefix.length) : d.docNumber
    );
    const nextRun = getNextThaiRunningNumber(existingNums);
    setDocNumber(`${prefix}${nextRun}`);
    setDocDate(new Date().toISOString().slice(0, 10));
    setFromOrg(isIncoming ? '' : 'มูลนิธิร่วมกุศลสมุทรปราการ');
    setToOrg(isIncoming ? 'มูลนิธิร่วมกุศลสมุทรปราการ' : '');
    setSubject('');
    setHandlerName(currentStaff?.fullName || '');
    setNotes('');
    setAttachmentName('');
    setAttachmentData('');
    setShowForm(true);
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 450 * 1024) {
      setNotes((prev) => `${prev ? prev + ' | ' : ''}แนบไฟล์: ${file.name} (ขนาดเกิน 450KB จัดเก็บเฉพาะชื่อไฟล์)`);
      setAttachmentName(file.name);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentName(file.name);
        setAttachmentData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim() || !fromOrg.trim() || !toOrg.trim() || !subject.trim()) return;

    const newDoc: RegistryDocument = {
      id: `${isIncoming ? 'inc' : 'out'}_${Date.now()}`,
      orgId: ORG_ID,
      docNumber: docNumber.trim(),
      docDate,
      fromOrg: fromOrg.trim(),
      toOrg: toOrg.trim(),
      subject: subject.trim(),
      handlerName: handlerName.trim() || currentStaff?.fullName || '-',
      attachmentName: attachmentName || undefined,
      attachmentData: attachmentData || undefined,
      notes: notes.trim() || undefined,
      createdBy: currentStaff?.id || 'local',
    };

    await saveRecord(collectionName, newDoc, true);
    await pushNotification(
      isIncoming ? `ลงทะเบียนหนังสือรับ ${newDoc.docNumber}` : `ออกเลขหนังสือส่ง ${newDoc.docNumber}`,
      `${newDoc.subject} (${isIncoming ? `จาก ${newDoc.fromOrg}` : `ถึง ${newDoc.toOrg}`})`,
      isIncoming ? 'incoming' : 'outgoing'
    );
    setShowForm(false);
  };

  const handlePrintSlip = (docItem: RegistryDocument) => {
    const slipTitle = isIncoming ? 'ใบปะหน้าทะเบียนหนังสือรับ' : 'ใบนำส่งทะเบียนหนังสือส่ง';
    const html = `
      ${renderOfficialHeaderHtml(slipTitle, docItem.docNumber)}
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
        <tr>
          <td style="width:180px;padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">
            ${isIncoming ? 'เลขที่หนังสือรับ' : 'เลขที่หนังสือส่ง'}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-family:monospace;font-weight:700;">
            ${escapeHtml(docItem.docNumber)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">
            ${isIncoming ? 'วันที่รับหนังสือ' : 'วันที่ออกหนังสือ'}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(formatThaiDate(docItem.docDate))}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">จากหน่วยงาน</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(docItem.fromOrg)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">${isIncoming ? 'ถึงหน่วยงาน' : 'ถึงหน่วยงาน/ผู้รับ'}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(docItem.toOrg)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">เรื่อง</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(docItem.subject)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">
            ${isIncoming ? 'ผู้รับหนังสือ' : 'ผู้ออกเลขหนังสือ'}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(docItem.handlerName)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ไฟล์แนบ / หมายเหตุ</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">
            ${escapeHtml(docItem.attachmentName || '-')} ${docItem.notes ? `<br/>${escapeHtml(docItem.notes)}` : ''}
          </td>
        </tr>
      </table>
      <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:13px;font-weight:600;">${isIncoming ? 'ผู้รับลงทะเบียนหนังสือ' : 'ผู้ออกเลขหนังสือ'}</div>
          <div style="margin:28px 0 8px;">..................................................</div>
          <div style="font-size:13px;">(${escapeHtml(docItem.handlerName)})</div>
          <div style="font-size:12px;color:#64748b;">วันที่ ${escapeHtml(formatThaiDate(docItem.docDate))}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:13px;font-weight:600;">ผู้พิจารณา / รับทราบ</div>
          <div style="margin:28px 0 8px;">..................................................</div>
          <div style="font-size:13px;">(..................................................)</div>
          <div style="font-size:12px;color:#64748b;">ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ</div>
        </div>
      </div>
    `;
    openPrintPreview(slipTitle, `${docItem.docNumber}`, html);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...docs]
      .filter((d) => {
        if (dateFilter && d.docDate !== dateFilter) return false;
        if (!q) return true;
        return (
          d.docNumber.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.fromOrg.toLowerCase().includes(q) ||
          d.toOrg.toLowerCase().includes(q) ||
          d.handlerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.docDate.localeCompare(a.docDate));
  }, [docs, searchTerm, dateFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isIncoming
              ? 'บันทึกหนังสือเข้าจากหน่วยงานภายนอก พร้อมออกเลขรับอัตโนมัติและพิมพ์ใบปะหน้า'
              : 'ออกเลขหนังสือส่งอัตโนมัติ บันทึกผู้รับปลายทาง และพิมพ์ใบนำส่ง PDF'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {isIncoming ? 'ลงทะเบียนหนังสือรับใหม่' : 'ออกเลขหนังสือส่งใหม่'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่หนังสือ, เรื่อง, หน่วยงาน หรือชื่อผู้รับ..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-3 h-10 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              ล้างวันที่
            </button>
          )}
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">เลขที่หนังสือ</th>
                <th className="py-3 px-4 whitespace-nowrap">
                  {isIncoming ? 'วันที่รับ' : 'วันที่ออก'}
                </th>
                <th className="py-3 px-4">จาก / ถึงหน่วยงาน</th>
                <th className="py-3 px-4">เรื่อง</th>
                <th className="py-3 px-4 whitespace-nowrap">
                  {isIncoming ? 'ผู้รับหนังสือ' : 'ผู้ออกเลข'}
                </th>
                <th className="py-3 px-4 text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    ไม่พบรายการหนังสือตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 tabular-nums whitespace-nowrap">
                      {item.docNumber}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatThaiDate(item.docDate)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">จาก: {item.fromOrg}</div>
                      <div className="text-slate-500">ถึง: {item.toOrg}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-900 max-w-md">
                      <p className="font-medium line-clamp-2">{item.subject}</p>
                      {item.attachmentName && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 mt-0.5">
                          <FileText className="w-3 h-3" />
                          {item.attachmentName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {item.handlerName}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {item.attachmentData && (
                          <a
                            href={item.attachmentData}
                            download={item.attachmentName || `${item.docNumber}.pdf`}
                            className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-lg"
                            title="ดาวน์โหลดไฟล์แนบ"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintSlip(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                          title={isIncoming ? 'พิมพ์ใบปะหน้า / PDF' : 'พิมพ์ใบนำส่ง / PDF'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {isIncoming ? 'ใบปะหน้า' : 'ใบนำส่ง'}
                        </button>
                        {canDeleteRegistry && (
                          <button
                            type="button"
                            onClick={() => removeRecord(collectionName, item.id)}
                            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="ลบรายการ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {isIncoming ? 'ลงทะเบียนหนังสือรับ' : 'ออกเลขทะเบียนหนังสือส่ง'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isIncoming ? 'เลขที่หนังสือรับ (อัตโนมัติ)' : 'เลขที่หนังสือส่ง (อัตโนมัติ)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isIncoming ? 'วันที่รับหนังสือ' : 'วันที่ออกหนังสือ'}
                  </label>
                  <input
                    type="date"
                    required
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    จากหน่วยงาน
                  </label>
                  <input
                    type="text"
                    required
                    value={fromOrg}
                    onChange={(e) => setFromOrg(e.target.value)}
                    placeholder="ระบุชื่อหน่วยงานต้นทาง"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isIncoming ? 'ถึงหน่วยงาน' : 'ถึงหน่วยงาน/ผู้รับ'}
                  </label>
                  <input
                    type="text"
                    required
                    value={toOrg}
                    onChange={(e) => setToOrg(e.target.value)}
                    placeholder="ระบุผู้รับหรือหน่วยงานปลายทาง"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เรื่อง</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="ระบุหัวข้อเรื่องหนังสือ"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isIncoming ? 'ผู้รับหนังสือ' : 'ผู้ออกเลขหนังสือ'}
                  </label>
                  <input
                    type="text"
                    required
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ไฟล์แนบ (PDF / ภาพสแกน)
                  </label>
                  <label className="flex items-center gap-2 h-10 px-3 text-xs text-slate-700 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{attachmentName || 'เลือกไฟล์แนบ...'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleAttachment}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C]"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
