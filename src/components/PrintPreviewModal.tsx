import React, { useMemo } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { exportToGoogleDocsFile } from '../utils/exportUtils';

interface PrintPreviewModalProps {
  open: boolean;
  title: string;
  fileName: string;
  htmlContent: string;
  onClose: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  open,
  title,
  fileName,
  htmlContent,
  onClose,
}) => {
  const pages = useMemo(() => {
    const raw = htmlContent.trim();
    if (!raw) return [''];
    if (raw.includes('<!-- A4_PAGE_BREAK -->')) {
      return raw
        .split('<!-- A4_PAGE_BREAK -->')
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return [raw];
  }, [htmlContent]);

  if (!open) return null;

  return (
    <div className="print-preview-root fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col">
      <div className="no-print bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            ตัวอย่างเอกสารขนาดมาตรฐาน A4 สำหรับพิมพ์หรือบันทึกเป็น PDF
            {pages.length > 1 ? ` · แบ่งหน้า ${pages.length} แผ่น` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportToGoogleDocsFile(title, htmlContent, fileName)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-blue-700" />
            ส่งออก Google Docs (.doc)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึก PDF (A4)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="ปิดหน้าต่างตัวอย่างเอกสาร"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="print-preview-scroll flex-1 overflow-y-auto p-4 md:p-8 bg-slate-200/70">
        <div className="print-only-sheet mx-auto w-full max-w-[210mm] space-y-6 text-slate-900">
          {pages.map((pageHtml, idx) => (
            <div
              key={idx}
              className="a4-sheet-page bg-white w-full min-h-[297mm] p-[12mm] sm:p-[14mm] shadow-sm border border-slate-200"
            >
              {pages.length > 1 && (
                <div className="no-print flex items-center justify-between text-[11px] font-medium text-slate-400 border-b border-dashed border-slate-200 pb-2 mb-4">
                  <span>หน้า {idx + 1} / {pages.length}</span>
                  <span>A4 (210 × 297 มม.)</span>
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
