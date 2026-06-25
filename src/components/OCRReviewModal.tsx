import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Trash2,
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  Clock,
  FileText,
  CalendarDays
} from "lucide-react";
import { OCRExtractedCommitment } from "../types";

interface OCRReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedCommitments: OCRExtractedCommitment[];
  ocrOverallConfidence: number;
  isAnalyzing: boolean;
  onUpdateCommitment: (id: string, field: keyof OCRExtractedCommitment, value: any) => void;
  onDeleteCommitment: (id: string) => void;
  onImportCommitments: () => Promise<void> | void;
}

export default function OCRReviewModal({
  isOpen,
  onClose,
  extractedCommitments,
  ocrOverallConfidence,
  isAnalyzing,
  onUpdateCommitment,
  onDeleteCommitment,
  onImportCommitments
}: OCRReviewModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative z-10 bg-white border border-zinc-200/80 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] p-6 flex flex-col gap-5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold font-display text-zinc-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                OCR Decomposed Commitments Review
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Review, edit, and adjust extracted commitments before launching them into your Saarthi planner.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Overall Confidence Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-zinc-50 rounded-2xl p-4 gap-4 border border-zinc-200/60">
            <div>
              <h4 className="text-xs font-bold text-zinc-800">Syllabus Text Accuracy Score</h4>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Our vision engine verified course structures, module timelines, and deliverables.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Scan Accuracy</span>
                <div className="text-lg font-bold font-mono text-indigo-600 leading-none mt-0.5">
                  {ocrOverallConfidence}%
                </div>
              </div>
              <div className="w-20 bg-zinc-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    ocrOverallConfidence >= 85 ? "bg-emerald-500" : ocrOverallConfidence >= 60 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${ocrOverallConfidence}%` }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable Queue Body */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {extractedCommitments.map((item, idx) => (
              <div
                key={item.id}
                className="border border-zinc-200/80 rounded-2xl p-5 bg-white shadow-xs hover:shadow-sm transition-all space-y-4 relative"
              >
                {/* Individual Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-mono py-0.5 px-2 rounded-md font-bold">
                      DELIVERABLE #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold py-0.5 px-2 rounded-md">
                      <span>Vision Confidence:</span>
                      <span>{item.confidence}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteCommitment(item.id)}
                    className="btn-danger p-1 rounded-lg"
                    title="Discard entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Title */}
                  <div className="md:col-span-8 space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">
                      Commitment Title
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => onUpdateCommitment(item.id, "title", e.target.value)}
                      className="input-primary p-2.5 font-sans font-semibold"
                      placeholder="e.g. CS 301 Midterm Prep"
                    />
                  </div>

                  {/* Deadline */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">
                      Target Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={item.deadline}
                      onChange={(e) => onUpdateCommitment(item.id, "deadline", e.target.value)}
                      className="input-primary p-2.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Description */}
                  <div className="md:col-span-8 space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">
                      Requirements & Syllabus notes
                    </label>
                    <textarea
                      value={item.description}
                      onChange={(e) => onUpdateCommitment(item.id, "description", e.target.value)}
                      rows={2}
                      className="input-primary p-2.5 resize-none leading-relaxed"
                      placeholder="Detailed tasks, chapters, rubrics..."
                    />
                  </div>

                  {/* Estimated effort */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">
                      Estimated Effort (Minutes)
                    </label>
                    <input
                      type="number"
                      value={item.estimatedMinutes}
                      onChange={(e) => onUpdateCommitment(item.id, "estimatedMinutes", parseInt(e.target.value) || 0)}
                      className="input-primary p-2.5 font-mono"
                      min="10"
                      max="1440"
                    />
                  </div>
                </div>
              </div>
            ))}

            {extractedCommitments.length === 0 && (
              <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-200/50 space-y-2">
                <p className="text-zinc-500 font-bold text-xs">No deliverables in review queue</p>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Exit this dialogue and scan another syllabus photo to populate tasks.
                </p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <button
              onClick={onClose}
              className="btn-secondary px-4 py-2"
            >
              Cancel Scan
            </button>
            <button
              onClick={onImportCommitments}
              disabled={isAnalyzing || extractedCommitments.length === 0}
              className="btn-primary px-6 py-2.5"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Decomposing Milestones...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Import {extractedCommitments.length} Deliverables</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
