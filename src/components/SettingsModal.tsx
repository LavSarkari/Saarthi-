import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  X,
  Key,
  MessageSquare,
  ShieldAlert,
  Clipboard,
  Check,
  Send,
  ExternalLink,
  Bot,
  Zap,
  CheckCircle,
  HelpCircle,
  RefreshCw
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "api" | "telegram";
  setActiveTab: (tab: "api" | "telegram") => void;
  settingsKeyInput: string;
  setSettingsKeyInput: (val: string) => void;
  onSaveSettings: () => Promise<void> | void;
  telegramChatId: string | null;
  telegramUsername: string | null;
  onUnlinkTelegram: () => Promise<void> | void;
  onTriggerBriefing: () => Promise<void> | void;
  telegramCode: string | null;
  isGeneratingTelegramCode: boolean;
  onGenerateLinkCode: () => Promise<void> | void;
  triggerToast: (msg: string) => void;
  telegramAlertsEnabled: boolean;
  telegramAlertSlots: string[];
  onSaveTelegramAlertSettings: (enabled: boolean, slots: string[]) => Promise<void> | void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  settingsKeyInput,
  setSettingsKeyInput,
  onSaveSettings,
  telegramChatId,
  telegramUsername,
  onUnlinkTelegram,
  onTriggerBriefing,
  telegramCode,
  isGeneratingTelegramCode,
  onGenerateLinkCode,
  triggerToast,
  telegramAlertsEnabled,
  telegramAlertSlots,
  onSaveTelegramAlertSettings
}: SettingsModalProps) {
  const [localTgEnabled, setLocalTgEnabled] = React.useState(telegramAlertsEnabled);
  const [localTgSlots, setLocalTgSlots] = React.useState<string[]>(telegramAlertSlots);

  React.useEffect(() => {
    if (isOpen) {
      setLocalTgEnabled(telegramAlertsEnabled);
      setLocalTgSlots(telegramAlertSlots);
    }
  }, [isOpen, telegramAlertsEnabled, telegramAlertSlots]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4 z-[200] overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
          className="relative z-10 bg-white border border-zinc-200/80 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-bold font-display text-zinc-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-800 animate-spin-slow" />
              Settings & Integrations
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex border-b border-zinc-100">
            <button
              onClick={() => setActiveTab("api")}
              className={`pb-2.5 text-[11px] font-semibold tracking-wide uppercase border-b-2 px-3 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "api"
                  ? "border-zinc-900 text-zinc-900 font-bold"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Gemini Key
            </button>
            <button
              onClick={() => setActiveTab("telegram")}
              className={`pb-2.5 text-[11px] font-semibold tracking-wide uppercase border-b-2 px-3 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "telegram"
                  ? "border-zinc-900 text-zinc-900 font-bold"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Telegram Bot
            </button>
          </div>

          {/* Tab Panels */}
          <AnimatePresence mode="wait">
            {activeTab === "api" ? (
              <motion.div
                key="api-panel"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Provide your private Google Gemini API key to run client-side planner algorithms, syllabus analysis, real-time voice bridges, and interactive copilot queries.
                </p>

                <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-1.5">
                  <h4 className="text-[10px] font-bold text-zinc-800 uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Secure Local Storage
                  </h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Keys are locked to your authenticated session. They are encrypted within your cloud profile so you never have to re-enter them when changing devices.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-mono tracking-wider uppercase text-zinc-400 font-bold">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={settingsKeyInput}
                    onChange={(e) => setSettingsKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="input-primary font-mono"
                  />
                </div>

                <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                  <span>Don't have an API key?</span>
                  <a
                    href="https://ai.google.dev/gemini-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    Get one for free at Google AI Studio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    onClick={onClose}
                    className="btn-secondary px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSaveSettings}
                    className="btn-primary px-5 py-2"
                  >
                    Save settings
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="telegram-panel"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {telegramChatId ? (
                  /* Connected state */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-150 rounded-2xl">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold tracking-wider text-emerald-850 uppercase flex items-center gap-1.5 font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Companion Linked
                        </span>
                        <p className="text-xs font-bold text-zinc-900 font-display">
                          {telegramUsername ? `@${telegramUsername}` : `Chat ID: ${telegramChatId}`}
                        </p>
                      </div>
                      <button
                        onClick={onUnlinkTelegram}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer transition-colors"
                      >
                        Disconnect Bot
                      </button>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Your Saarthi account is connected to your Telegram Bot! You will receive instant **Critical Rescue Alerts** on Telegram when deadlines compress, and can query commands or dictate voice notes.
                    </p>

                    <div className="space-y-4 pt-2 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">
                          Critical Risk Push Alerts
                        </label>
                        <button
                          onClick={() => setLocalTgEnabled(!localTgEnabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            localTgEnabled ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              localTgEnabled ? 'translate-x-4' : 'translate-x-1'
                            } ${localTgEnabled ? 'ml-0.5' : ''}`}
                          />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          Daily Digest Slots (Max 3)
                        </label>
                        <p className="text-[10px] text-zinc-400 mb-2">Configure specific times to receive scheduled summary briefings of your active tasks and risks.</p>
                        {localTgSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot}
                              onChange={(e) => {
                                const newSlots = [...localTgSlots];
                                newSlots[idx] = e.target.value;
                                setLocalTgSlots(newSlots);
                              }}
                              className="input-primary font-mono py-1.5 px-2 text-xs w-full max-w-[120px]"
                            />
                            <button
                              onClick={() => {
                                const newSlots = [...localTgSlots];
                                newSlots.splice(idx, 1);
                                setLocalTgSlots(newSlots);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-rose-500 bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {localTgSlots.length < 3 && (
                          <button
                            onClick={() => setLocalTgSlots([...localTgSlots, "09:00"])}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 mt-1 cursor-pointer"
                          >
                            + Add Time Slot
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-3">
                      <h4 className="text-[10px] font-bold text-zinc-800 uppercase tracking-wide font-mono flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-zinc-600" />
                        Trigger Live Sync Briefing
                      </h4>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Test your companion bot immediately by sending a personalized morning briefing summarizing current tasks, risk zones, and recommended sprints.
                      </p>
                      <button
                        onClick={onTriggerBriefing}
                        className="btn-primary w-full py-2.5"
                      >
                        Send Morning Briefing
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={onClose}
                        className="btn-secondary px-4 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onSaveTelegramAlertSettings(localTgEnabled, localTgSlots);
                          onClose();
                        }}
                        className="btn-primary px-5 py-2 text-xs"
                      >
                        Save Preferences
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Unconnected state */
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Sync your syllabus planner with Telegram to unlock status queries, interactive milestones updating, and instant notification alerts.
                    </p>

                    <div className="space-y-2 text-[11px] text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-200/40">
                      <p className="flex items-start gap-1.5">
                        <span className="font-mono font-bold text-zinc-400">1.</span>
                        <span>Start a conversation with your configured Telegram Bot.</span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <span className="font-mono font-bold text-zinc-400">2.</span>
                        <span>Send the command <code className="bg-white border border-zinc-200 px-1 py-0.5 rounded font-mono font-bold text-zinc-800">/start</code>.</span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <span className="font-mono font-bold text-zinc-400">3.</span>
                        <span>Tap below to generate a secure linking command.</span>
                      </p>
                    </div>

                    {telegramCode ? (
                      <div className="p-4 bg-zinc-950 text-white rounded-xl flex flex-col items-center justify-center space-y-3.5 animate-fade-in border border-zinc-800">
                        <span className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Execute Linking Command</span>
                        
                        <div
                          onClick={() => {
                            navigator.clipboard.writeText(`/link ${telegramCode}`);
                            triggerToast("Linking command copied!");
                          }}
                          className="font-mono text-base font-bold tracking-widest text-white bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg shadow-inner cursor-pointer hover:bg-zinc-800 hover:scale-102 transition-all flex items-center gap-2"
                          title="Click to copy whole link command"
                        >
                          <code>/link {telegramCode}</code>
                          <Clipboard className="w-3.5 h-3.5 text-zinc-400" />
                        </div>

                        <p className="text-[10px] text-zinc-400 text-center leading-normal">
                          Tap command to copy, then paste and send it directly to your companion bot.
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={onGenerateLinkCode}
                        disabled={isGeneratingTelegramCode}
                        className="btn-primary w-full py-3"
                      >
                        {isGeneratingTelegramCode ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Generate Link Code</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
