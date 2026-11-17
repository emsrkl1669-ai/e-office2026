import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser, PenTool, Sparkles, Upload, X } from 'lucide-react';
import { ElectronicSignature } from '../types/eoffice';
import { generateSignatureHash } from '../utils/crypto';

interface SignaturePadModalProps {
  open: boolean;
  title?: string;
  signerName: string;
  signerPosition: string;
  documentRef: string;
  savedSignatureDataUrl?: string;
  onClose: () => void;
  onConfirm: (signature: ElectronicSignature) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  open,
  title = 'ลงลายมือชื่ออิเล็กทรอนิกส์',
  signerName,
  signerPosition,
  documentRef,
  savedSignatureDataUrl,
  onClose,
  onConfirm,
}) => {
  const [method, setMethod] = useState<'draw' | 'upload' | 'auto'>('draw');
  const [inkColor, setInkColor] = useState<'blue' | 'black'>('blue');
  const [uploadedUrl, setUploadedUrl] = useState<string>(savedSignatureDataUrl || '');
  const [autoPreviewUrl, setAutoPreviewUrl] = useState<string>('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const inkHex = inkColor === 'blue' ? '#1D4ED8' : '#0F172A';

  useEffect(() => {
    if (!open) return;
    setHasDrawn(false);
    setUploadedUrl(savedSignatureDataUrl || '');
  }, [open, savedSignatureDataUrl]);

  useEffect(() => {
    if (!open || method !== 'auto') return;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 480;
    offCanvas.height = 160;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    ctx.strokeStyle = inkHex;
    ctx.fillStyle = inkHex;
    ctx.font = 'italic 600 32px "Sarabun", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = signerName.replace(/^(นาย|นางสาว|นาง|ว่าที่ร้อยตรี)\s*/, '');
    ctx.fillText(displayName || signerName, offCanvas.width / 2, 72);

    ctx.beginPath();
    ctx.lineWidth = 2.2;
    ctx.moveTo(90, 108);
    ctx.bezierCurveTo(180, 124, 300, 96, 390, 112);
    ctx.stroke();

    setAutoPreviewUrl(offCanvas.toDataURL('image/png'));
  }, [open, method, inkHex, signerName]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const nextPt = getCanvasPoint(e);
    const prevPt = lastPointRef.current || nextPt;

    ctx.strokeStyle = inkHex;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prevPt.x, prevPt.y);
    ctx.lineTo(nextPt.x, nextPt.y);
    ctx.stroke();

    lastPointRef.current = nextPt;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    let dataUrl = '';
    if (method === 'draw') {
      if (!canvasRef.current || !hasDrawn) return;
      dataUrl = canvasRef.current.toDataURL('image/png');
    } else if (method === 'upload') {
      if (!uploadedUrl) return;
      dataUrl = uploadedUrl;
    } else {
      dataUrl = autoPreviewUrl;
    }

    if (!dataUrl) return;
    setIsSubmitting(true);
    try {
      const signedAt = new Date().toISOString();
      const sha256 = await generateSignatureHash({
        signerName,
        signerPosition,
        documentRef,
        signedAt,
        signaturePreview: dataUrl,
      });
      onConfirm({
        dataUrl,
        signerName,
        signerPosition,
        signedAt,
        sha256,
        inkColor,
        method,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const canSubmit =
    (method === 'draw' && hasDrawn) ||
    (method === 'upload' && Boolean(uploadedUrl)) ||
    (method === 'auto' && Boolean(autoPreviewUrl));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {signerName} · {signerPosition}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="ปิดหน้าต่างลายเซ็น"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Method Tabs & Ink Color */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMethod('draw')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  method === 'draw'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                วาดลายเซ็น
              </button>
              <button
                type="button"
                onClick={() => setMethod('upload')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  method === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                อัปโหลด
              </button>
              <button
                type="button"
                onClick={() => setMethod('auto')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  method === 'auto'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                สร้างอัตโนมัติ
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">สีหมึก:</span>
              <button
                type="button"
                onClick={() => setInkColor('blue')}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  inkColor === 'blue'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                หมึกสีน้ำเงิน
              </button>
              <button
                type="button"
                onClick={() => setInkColor('black')}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  inkColor === 'black'
                    ? 'border-slate-900 bg-slate-100 text-slate-900 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                หมึกสีดำ
              </button>
            </div>
          </div>

          {/* Canvas / Upload / Auto */}
          {method === 'draw' && (
            <div className="space-y-2">
              <div className="relative border border-slate-300 rounded-lg bg-slate-50/70 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
                {!hasDrawn && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                    ใช้เมาส์หรือนิ้ว/ปากกาเซ็นชื่อในกรอบนี้ (รองรับ Touch Screen)
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>ระบบจะประทับชื่อและรหัสตรวจสอบ SHA-256 อัตโนมัติ</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700 px-2 py-1 rounded hover:bg-slate-100"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  ล้างกระดาน
                </button>
              </div>
            </div>
          )}

          {method === 'upload' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <Upload className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-sm font-medium text-slate-700">
                  เลือกไฟล์รูปลายเซ็น (PNG / JPG)
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  แนะนำพื้นหลังโปร่งใสหรือสีขาว
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {uploadedUrl && (
                <div className="border border-slate-200 rounded-lg p-3 bg-white flex flex-col items-center">
                  <img
                    src={uploadedUrl}
                    alt="ตัวอย่างลายเซ็นที่อัปโหลด"
                    className="max-h-28 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {method === 'auto' && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[160px]">
              {autoPreviewUrl && (
                <img
                  src={autoPreviewUrl}
                  alt="ลายเซ็นสร้างอัตโนมัติ"
                  className="max-h-32 object-contain"
                />
              )}
              <span className="text-xs text-slate-500 mt-2">
                ลายเซ็นดิจิทัลอัตโนมัติสำหรับ {signerName}
              </span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>ผู้ลงนาม: <strong className="text-slate-900">{signerName}</strong></span>
            <span className="font-mono text-slate-500">อ้างอิง: {documentRef}</span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'กำลังประทับลายเซ็น...' : 'ยืนยันลงนาม SHA-256'}
          </button>
        </div>
      </div>
    </div>
  );
};
