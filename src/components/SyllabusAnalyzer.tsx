import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  FileText,
  X,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface SyllabusAnalyzerProps {
  analyzerFile: File | null;
  setAnalyzerFile: (file: File | null) => void;
  analyzerPreview: string | null;
  setAnalyzerPreview: (preview: string | null) => void;
  isAnalyzing: boolean;
  isOcrProcessing: boolean;
  onAnalyzeSyllabus: () => Promise<void> | void;
  onOcrExtraction: () => Promise<void> | void;
  triggerToast: (msg: string) => void;
}

export default function SyllabusAnalyzer({
  analyzerFile,
  setAnalyzerFile,
  analyzerPreview,
  setAnalyzerPreview,
  isAnalyzing,
  isOcrProcessing,
  onAnalyzeSyllabus,
  onOcrExtraction,
  triggerToast
}: SyllabusAnalyzerProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerToast("Invalid format: Please upload an image file (PNG, JPG, WEBP).");
      return;
    }
    setAnalyzerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAnalyzerPreview(reader.result as string);
      triggerToast(`Loaded document: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setAnalyzerFile(null);
    setAnalyzerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const activeProcessing = isAnalyzing || isOcrProcessing;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5 transition-all">
      <div className="space-y-1">
        <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Camera className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
          Document Scanner
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Upload a syllabus, exam schedule, timetable, or course handout to let Saarthi organize milestones for you.
        </p>
      </div>

      {!analyzerPreview ? (
        /* Drag and Drop Zone */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3.5 transition-all cursor-pointer select-none text-center ${
            isDragActive
              ? "border-zinc-950 dark:border-zinc-300 bg-zinc-50 dark:bg-zinc-800/50"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
            <Upload className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Drag syllabus snapshot here or browse
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              Supports JPEG, PNG, WEBP files up to 10MB
            </p>
          </div>
        </div>
      ) : (
        /* File Preview Container */
        <div className="space-y-4">
          <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-950 aspect-video flex items-center justify-center max-h-[220px]">
            <img
              src={analyzerPreview}
              alt="Uploaded document preview"
              className="w-full h-full object-contain"
            />
            
            {/* Overlay buttons */}
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={clearFile}
                disabled={activeProcessing}
                className="p-1.5 bg-zinc-950/85 dark:bg-zinc-900/90 hover:bg-zinc-950 dark:hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom tag info */}
            <div className="absolute bottom-3 left-3 bg-zinc-950/85 dark:bg-zinc-900/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 max-w-[80%] truncate">
              <ImageIcon className="w-3 h-3 text-zinc-300 dark:text-zinc-400" />
              <span className="truncate">{analyzerFile?.name}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Analyze Syllabus */}
            <button
              onClick={onAnalyzeSyllabus}
              disabled={activeProcessing}
              className="btn-secondary py-3 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
              ) : (
                <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              )}
              <span>Deconstruct Syllabus</span>
            </button>

            {/* OCR Extract Multi-commitments */}
            <button
              onClick={onOcrExtraction}
              disabled={activeProcessing}
              className="btn-primary py-3 flex items-center justify-center gap-2"
            >
              {isOcrProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Extract Checklist Tasks</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
