import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { X, Camera, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WebcamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const WebcamModal: React.FC<WebcamModalProps> = ({ isOpen, onClose, onCapture }) => {
  const { t } = useTranslation();
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const handleConfirm = async () => {
    if (imgSrc && !isCapturing) {
      setIsCapturing(true);
      try {
        // Robust way to convert data URL to Blob
        const parts = imgSrc.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        await onCapture(file);
        handleClose();
      } catch (err) {
        console.error("Error confirming photo:", err);
        setError("Failed to process photo. Please try again.");
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const handleClose = () => {
    setImgSrc(null);
    setError(null);
    setIsCapturing(false);
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {t('capture_photo', 'ถ่ายภาพ')}
          </h3>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-video bg-black flex items-center justify-center">
          {error ? (
            <div className="text-center p-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-white font-medium">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="mt-4 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                {t('retry', 'ลองใหม่')}
              </button>
            </div>
          ) : imgSrc ? (
            <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: facingMode,
                width: 1280,
                height: 720
              }}
              onUserMediaError={(err) => setError(err.toString())}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="p-6 flex items-center justify-center gap-4">
          {imgSrc ? (
            <>
              <button
                onClick={() => setImgSrc(null)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('retake', 'ถ่ายใหม่')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isCapturing}
                className={`flex-1 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 ${isCapturing ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isCapturing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {isCapturing ? t('processing', 'กำลังประมวลผล...') : t('confirm', 'ยืนยัน')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleFacingMode}
                className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title={t('switch_camera', 'สลับกล้อง')}
              >
                <RefreshCw className="w-6 h-6" />
              </button>
              <button
                onClick={capture}
                className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-primary/20"
              >
                <Camera className="w-8 h-8" />
              </button>
              <div className="w-16" /> {/* Spacer */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
