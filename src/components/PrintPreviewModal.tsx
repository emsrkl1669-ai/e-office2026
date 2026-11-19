import React, { useMemo } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { exportToGoogleDocsFile } from '../utils/exportUtils';

interface PrintPreviewModalProps {
  open: boolean;
  title: string;
  fileName: string;
  htmlContent: string;
  orientation?: 'portrait' | 'landscape';
  onClose: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  open,
  title,
  fileName,
  htmlContent,
  orientation = 'portrait',
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

  const isLandscape = orientation === 'landscape';

  return (
    <div className="print-preview-root fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col">
      {isLandscape && (
        <style>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 8mm 10mm;
            }
          }
        `}</style>
      )}
      <div className="no-print bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            ตัวอย่างเอกสารขนาดมาตรฐาน A4 ({isLandscape ? 'แนวนอน 297 × 210 มม.' : 'แนวตั้ง 210 × 297 มม.'}) สำหรับพิมพ์หรือบันทึกเป็น PDF
            {pages.length > 1 ? ` · แบ่งหน้า ${pages.length} แผ่น` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportToGoogleDocsFile(title, htmlContent, fileName, orientation)}
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
            พิมพ์ / บันทึก PDF (A4 {isLandscape ? 'แนวนอน' : 'แนวตั้ง'})
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
        <div
          className={`print-only-sheet mx-auto w-full space-y-6 text-slate-900 ${
            isLandscape ? 'max-w-[297mm]' : 'max-w-[210mm]'
          }`}
        >
          {pages.map((pageHtml, idx) => (
            <div
              key={idx}
              className={`a4-sheet-page bg-white w-full shadow-sm border border-slate-200 ${
                isLandscape
                  ? 'min-h-[210mm] p-[10mm] sm:p-[11mm]'
                  : 'min-h-[297mm] py-[10mm] px-[6%]'
              }`}
            >
              {pages.length > 1 && (
                <div className="no-print flex items-center justify-between text-[11px] font-medium text-slate-400 border-b border-dashed border-slate-200 pb-2 mb-4">
                  <span>หน้า {idx + 1} / {pages.length}</span>
                  <span>{isLandscape ? 'A4 แนวนอน (297 × 210 มม.)' : 'A4 (210 × 297 มม.)'}</span>
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
