import * as XLSX from 'xlsx';
import { FOUNDATION_LOGO_PATH, FOUNDATION_NAME } from '../data/seedData';
import { ElectronicSignature } from '../types/eoffice';

export function exportToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportToCsvUtf8(
  rows: Record<string, string | number>[],
  fileName: string
): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, `${fileName}.csv`);
}

export function exportToGoogleDocsFile(
  title: string,
  bodyHtml: string,
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  const formattedBody = bodyHtml.replace(
    /<!--\s*A4_PAGE_BREAK\s*-->/g,
    '<br clear="all" style="page-break-before:always;mso-break-type:section-break;" />'
  );
  const pageCss =
    orientation === 'landscape'
      ? '@page { size: A4 landscape; mso-page-orientation: landscape; margin: 1.0cm 1.2cm; }'
      : '@page { size: A4 portrait; margin: 1.0cm 1.26cm; }';
  const htmlDoc = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${pageCss}
    body { font-family: 'TH Sarabun New', 'Sarabun', 'TH SarabunPSK', sans-serif; font-size: 13pt; color: #0f172a; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; font-size: 11.5pt; }
    th { background-color: #f1f5f9; font-weight: bold; }
    h1, h2, h3 { color: #0f2744; margin-bottom: 6px; }
  </style>
</head>
<body>
  ${formattedBody}
</body>
</html>`;
  const blob = new Blob(['\uFEFF' + htmlDoc], {
    type: 'application/msword;charset=utf-8',
  });
  triggerDownload(blob, `${fileName}.doc`);
}

export async function exportToGoogleSheetsClipboardAndDownload(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string
): Promise<boolean> {
  exportToExcel(rows, sheetName, fileName);
  if (rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const tsv = [
    headers.join('\t'),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? '').replace(/\t|\n/g, ' ')).join('\t')),
  ].join('\n');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsv);
      return true;
    }
  } catch {
    // Clipboard blocked; Excel download still succeeded
  }
  return false;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderOfficialHeaderHtml(docTitle: string, docNumber?: string): string {
  return `
    <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #0f2744;padding-bottom:12px;margin-bottom:16px;">
      <img src="${FOUNDATION_LOGO_PATH}" alt="${FOUNDATION_NAME}" style="width:68px;height:68px;object-fit:contain;" />
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:700;color:#0f2744;">${FOUNDATION_NAME}</div>
        <div style="font-size:13px;color:#475569;">ระบบสารบรรณอิเล็กทรอนิกส์ (e-Office) · จังหวัดสมุทรปราการ</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:15px;font-weight:700;color:#0f2744;">${escapeHtml(docTitle)}</div>
        ${docNumber ? `<div style="font-size:13px;font-family:monospace;color:#334155;">เลขที่: ${escapeHtml(docNumber)}</div>` : ''}
      </div>
    </div>
  `;
}

export function renderSignatureBlockHtml(
  roleLabel: string,
  sig?: ElectronicSignature,
  fallbackName?: string,
  fallbackPosition?: string
): string {
  if (sig) {
    return `
      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;text-align:center;min-height:132px;">
        <div style="font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">${escapeHtml(roleLabel)}</div>
        <img src="${sig.dataUrl}" alt="ลายเซ็น" style="height:48px;max-width:160px;object-fit:contain;margin:4px auto;display:block;" />
        <div style="font-size:13px;font-weight:600;color:#0f172a;">(${escapeHtml(sig.signerName)})</div>
        <div style="font-size:11px;color:#475569;">${escapeHtml(sig.signerPosition)}</div>
        <div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:4px;word-break:break-all;">
          SHA-256: ${escapeHtml(sig.sha256.slice(0, 24))}...
        </div>
      </div>
    `;
  }
  return `
    <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:10px 12px;text-align:center;min-height:132px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="font-size:12px;color:#475569;font-weight:600;">${escapeHtml(roleLabel)}</div>
      <div style="font-size:12px;color:#94a3b8;padding:14px 0;">......................................................</div>
      <div>
        <div style="font-size:12px;color:#334155;">(${escapeHtml(fallbackName || '........................................')})</div>
        ${fallbackPosition ? `<div style="font-size:11px;color:#64748b;">${escapeHtml(fallbackPosition)}</div>` : ''}
      </div>
    </div>
  `;
}
