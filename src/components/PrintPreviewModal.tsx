import React from 'react';
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col">
      <div className="no-print bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">ตัวอย่างเอกสารขนาดมาตรฐาน A4 สำหรับพิมพ์หรือบันทึกเป็น PDF</p>
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

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-200/70">
        <div
          className="print-only-sheet bg-white mx-auto w-full max-w-[210mm] min-h-[297mm] p-[14mm] shadow-sm border border-slate-200 text-slate-900"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
};
