import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import {
  escapeHtml,
  exportToCsvUtf8,
  exportToExcel,
  exportToGoogleDocsFile,
  exportToGoogleSheetsClipboardAndDownload,
  renderOfficialHeaderHtml,
} from '../utils/exportUtils';
import { formatThaiDate } from '../utils/leaveCalculator';

type ReportKey =
  | 'incoming'
  | 'outgoing'
  | 'leave'
  | 'loans'
  | 'inventory'
  | 'repairs'
  | 'vehicles'
  | 'pavilion'
  | 'fire_relief';

const REPORT_DEFS: { key: ReportKey; title: string; subtitle: string }[] = [
  { key: 'incoming', title: 'ทะเบียนหนังสือรับ', subtitle: 'สรุปรายการหนังสือเข้าและหน่วยงานต้นทาง' },
  { key: 'outgoing', title: 'ทะเบียนหนังสือส่ง', subtitle: 'สรุปรายการออกเลขหนังสือส่งและปลายทาง' },
  { key: 'leave', title: 'รายงานการลา', subtitle: 'สรุปสถิติใบลาและคำร้องพิเศษรายบุคคล' },
  { key: 'loans', title: 'รายงานการยืม-คืน', subtitle: 'รวมรายการยืม-คืนพัสดุการแพทย์และอุปกรณ์ครัว' },
  { key: 'inventory', title: 'รายงานครุภัณฑ์', subtitle: 'ยอดคงเหลือพัสดุการแพทย์และอุปกรณ์ครัวทั้งหมด' },
  { key: 'repairs', title: 'รายงานการซ่อม', subtitle: 'สรุปงานแจ้งซ่อม 4 หมวดและประมาณการค่าใช้จ่าย' },
  { key: 'vehicles', title: 'รายงานรถพยาบาล', subtitle: 'สถานะรถพยาบาล/กู้ภัย และผลตรวจสภาพ 12 รายการ' },
  { key: 'pavilion', title: 'รายงานการใช้ศาลาสวดอภิธรรม', subtitle: 'สถิติคำขอใช้ศาลา กำหนดการ และสถานะอนุมัติ' },
  { key: 'fire_relief', title: 'รายงานสงเคราะห์เพลิงไหม้ (อค.02)', subtitle: 'สรุปเหตุเพลิงไหม้ ผู้ประสบภัย และยอดเงิน/สิ่งของสงเคราะห์' },
];

export const ReportsModule: React.FC = () => {
  const {
    incomingDocs,
    outgoingDocs,
    leaveRequests,
    medicalItems,
    medicalLoans,
    kitchenItems,
    kitchenLoans,
    vehicles,
    repairs,
    pavilionRequests,
    fireReliefRequests,
    openPrintPreview,
  } = useEOffice();

  const [selectedKey, setSelectedKey] = useState<ReportKey>('incoming');
  const [toastMsg, setToastMsg] = useState('');

  const buildRows = (key: ReportKey): Record<string, string | number>[] => {
    switch (key) {
      case 'incoming':
        return incomingDocs.map((d) => ({
          เลขที่หนังสือรับ: d.docNumber,
          วันที่รับ: formatThaiDate(d.docDate),
          จากหน่วยงาน: d.fromOrg,
          ถึงหน่วยงาน: d.toOrg,
          เรื่อง: d.subject,
          ผู้รับหนังสือ: d.handlerName,
        }));
      case 'outgoing':
        return outgoingDocs.map((d) => ({
          เลขที่หนังสือส่ง: d.docNumber,
          วันที่ออก: formatThaiDate(d.docDate),
          จากหน่วยงาน: d.fromOrg,
          ถึงผู้รับ: d.toOrg,
          เรื่อง: d.subject,
          ผู้ออกเลข: d.handlerName,
        }));
      case 'leave':
        return leaveRequests.map((l) => ({
          เลขที่: l.docNumber,
          ชื่อผู้ยื่น: l.applicantName,
          ตำแหน่ง: l.position,
          ประเภท: l.leaveType,
          วันเริ่ม: formatThaiDate(l.startDate),
          วันสิ้นสุด: formatThaiDate(l.endDate),
          จำนวนวัน: l.totalDays,
          สถานะ: l.status,
        }));
      case 'loans':
        return [
          ...medicalLoans.map((l) => ({
            หมวด: 'พัสดุการแพทย์',
            เลขที่: l.docNumber,
            ผู้ยืม: l.borrowerName,
            วัตถุประสงค์: l.purpose,
            วันที่ยืม: formatThaiDate(l.borrowDate),
            กำหนดคืน: formatThaiDate(l.dueDate),
            สถานะ: l.status === 'returned' ? 'คืนแล้ว' : 'กำลังยืม',
          })),
          ...kitchenLoans.map((l) => ({
            หมวด: 'อุปกรณ์ครัว',
            เลขที่: l.docNumber,
            ผู้ยืม: l.borrowerName,
            วัตถุประสงค์: l.purpose,
            วันที่ยืม: formatThaiDate(l.borrowDate),
            กำหนดคืน: formatThaiDate(l.dueDate),
            สถานะ: l.status === 'returned' ? 'คืนแล้ว' : 'กำลังยืม',
          })),
        ];
      case 'inventory':
        return [
          ...medicalItems.map((i) => ({
            ประเภทคลัง: 'พัสดุการแพทย์',
            รหัส: i.code,
            ชื่อรายการ: i.name,
            หมวดหมู่: i.category,
            ทั้งหมด: i.totalStock,
            คงเหลือ: i.availableStock,
            หน่วย: i.unit,
          })),
          ...kitchenItems.map((i) => ({
            ประเภทคลัง: 'อุปกรณ์ครัว',
            รหัส: i.code,
            ชื่อรายการ: i.name,
            หมวดหมู่: i.category,
            ทั้งหมด: i.totalStock,
            คงเหลือ: i.availableStock,
            หน่วย: i.unit,
          })),
        ];
      case 'repairs':
        return repairs.map((r) => ({
          เลขที่: r.docNumber,
          หมวด: r.category,
          ประเภทย่อย: r.subCategory,
          ทรัพย์สิน: r.assetName,
          อาการ: r.issueDescription,
          ประมาณราคา: r.estimatedCost,
          สถานะ: r.status,
        }));
      case 'vehicles':
        return vehicles.map((v) => ({
          นามเรียกขาน: v.callsign,
          ทะเบียน: v.plateNumber,
          ประเภทรถ: v.vehicleType,
          สถานีประจำ: v.station,
          พนักงานขับรถ: v.driverName,
          สถานะ: v.status,
        }));
      case 'pavilion':
        return pavilionRequests.map((p) => ({
          เลขที่: p.docNumber,
          ศาลา: p.pavilionName,
          ผู้เสียชีวิต: p.deceasedName,
          ผู้ขอใช้ศาลา: p.applicantName,
          เบอร์โทร: p.phone,
          วันเข้าใช้: formatThaiDate(p.checkInDate),
          วันออก: formatThaiDate(p.checkOutDate),
          สถานะ: p.status,
        }));
      case 'fire_relief':
        return fireReliefRequests.map((f) => ({
          เลขที่แบบ: f.docNumber,
          วันที่เกิดเหตุ: formatThaiDate(f.incidentDate),
          สถานที่เกิดเหตุ: f.incidentLocation,
          จำนวนผู้ประสบภัย: (f.victims || []).reduce((s, v) => s + Number(v.totalCount || 0), 0),
          มูลค่ารวมบาท: f.totalValue,
          เบิกเงินสดบาท: f.cashDisbursed,
          สถานะ: f.status,
        }));
    }
  };

  const activeDef = REPORT_DEFS.find((r) => r.key === selectedKey)!;
  const rows = buildRows(selectedKey);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const buildReportHtml = () => {
    const headerRow = columns
      .map((c) => `<th style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9;">${escapeHtml(c)}</th>`)
      .join('');
    const bodyRows = rows
      .map(
        (r) =>
          `<tr>${columns
            .map((c) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(String(r[c] ?? ''))}</td>`)
            .join('')}</tr>`
      )
      .join('');

    return `
      ${renderOfficialHeaderHtml(activeDef.title)}
      <p style="font-size:13px;color:#475569;margin-bottom:10px;">${escapeHtml(activeDef.subtitle)} · จำนวนทั้งหมด ${rows.length} รายการ</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  };

  const handleGoogleSheets = async () => {
    const copied = await exportToGoogleSheetsClipboardAndDownload(
      rows,
      activeDef.title,
      `report_${selectedKey}`
    );
    setToastMsg(
      copied
        ? 'ดาวน์โหลดไฟล์และคัดลอกข้อมูลตารางสำหรับวางใน Google Sheets เรียบร้อยแล้ว'
        : 'ดาวน์โหลดไฟล์สำหรับเปิดใน Google Sheets เรียบร้อยแล้ว'
    );
    setTimeout(() => setToastMsg(''), 4000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          รายงานและการส่งออกข้อมูล (9 รายงานหลัก)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          รองรับการส่งออก PDF, Excel (.xlsx), CSV UTF-8, Google Sheets, Google Docs และ Print A4
        </p>
      </div>

      {/* Report Selector Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_DEFS.map((rep) => (
          <button
            key={rep.key}
            type="button"
            onClick={() => setSelectedKey(rep.key)}
            className={`text-left p-3.5 rounded-xl border transition-colors ${
              selectedKey === rep.key
                ? 'bg-[#0F2744] text-white border-[#0F2744]'
                : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="font-display text-sm font-semibold">{rep.title}</div>
            <div
              className={`text-xs mt-1 line-clamp-2 ${
                selectedKey === rep.key ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {rep.subtitle}
            </div>
          </button>
        ))}
      </div>

      {/* Export Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">{activeDef.title}</h3>
          <p className="text-xs text-slate-500 tabular-nums">พบข้อมูล {rows.length} รายการ</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openPrintPreview(activeDef.title, `report_${selectedKey}`, buildReportHtml())}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF / Print A4
          </button>
          <button
            type="button"
            onClick={() => exportToExcel(rows, activeDef.title, `report_${selectedKey}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => exportToCsvUtf8(rows, `report_${selectedKey}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Table2 className="w-3.5 h-3.5" />
            CSV UTF-8
          </button>
          <button
            type="button"
            onClick={handleGoogleSheets}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Google Sheets
          </button>
          <button
            type="button"
            onClick={() =>
              exportToGoogleDocsFile(activeDef.title, buildReportHtml(), `report_${selectedKey}`)
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            Google Docs
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          {toastMsg}
        </div>
      )}

      {/* Preview Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                {columns.map((col) => (
                  <th key={col} className="py-3 px-4 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, columns.length)} className="py-10 text-center text-slate-500">
                    ไม่มีข้อมูลในรายงานนี้
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    {columns.map((col) => (
                      <td key={col} className="py-2.5 px-4 tabular-nums">
                        {String(r[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
