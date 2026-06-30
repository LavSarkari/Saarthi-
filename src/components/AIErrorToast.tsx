import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, Key, Settings, RefreshCw, X, Bot } from 'lucide-react';
import { ParsedAIError } from '../utils/AIErrorHandler';

interface AIErrorToastProps {
  error: ParsedAIError | null;
  onClose: () => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export default function AIErrorToast({ error, onClose, onRetry, onOpenSettings }: AIErrorToastProps) {
  useEffect(() => {
    if (error && error.severity === 'info') {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClose]);

  if (!error) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[calc(100%-2rem)] md:w-full">
      <div className={`
        bg-white dark:bg-zinc-900 border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300
        ${error.severity === 'error' ? 'border-rose-200 dark:border-rose-900/50' : 
          error.severity === 'warning' ? 'border-amber-200 dark:border-amber-900/50' : 
          'border-zinc-200 dark:border-zinc-800'}
      `}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex gap-4">
            <div className={`
              w-10 h-10 rounded-xl shrink-0 flex items-center justify-center
              ${error.severity === 'error' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 
                error.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}
            `}>
              {error.severity === 'error' ? <AlertCircle className="w-5 h-5" /> : 
               error.severity === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
               <Bot className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                {error.displayTitle}
              </h3>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-2 whitespace-pre-wrap">
                {error.displayMessage}
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="shrink-0 p-1.5 h-fit text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error.suggestedAction && error.suggestedAction.actionType !== 'none' && (
            <div className="flex justify-end gap-2 mt-1">
              {error.suggestedAction.actionType === 'retry' && onRetry && (
                <button 
                  onClick={() => { onClose(); onRetry(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {error.suggestedAction.label}
                </button>
              )}
              
              {(error.suggestedAction.actionType === 'add_key' || error.suggestedAction.actionType === 'open_settings') && onOpenSettings && (
                <button 
                  onClick={() => { onClose(); onOpenSettings(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {error.suggestedAction.label}
                </button>
              )}
              
              {error.suggestedAction.actionType === 'check_status' && (
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  {error.suggestedAction.label}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
