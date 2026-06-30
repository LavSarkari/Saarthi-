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
  RefreshCw,
  LogOut,
  HeartHandshake,
  Brain,
  Calendar,
} from "lucide-react";
import CompanionCenter from "./CompanionCenter";
import RecoveryCenter from "./RecoveryCenter";
import LearningCenter from "./LearningCenter";
import { CompanionProfile } from "../types";

export type SettingsTab = "api" | "telegram" | "workspace" | "companion" | "recovery" | "memory";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
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
  onSaveTelegramAlertSettings: (
    enabled: boolean,
    slots: string[],
  ) => Promise<void> | void;

  // Companion Props
  companionProfile: CompanionProfile | null;
  onUpdateCompanionProfile: (
    updates: Partial<CompanionProfile>,
  ) => Promise<void>;

  // Recovery Props
  userId: string | null;
  onRecovered: () => void;
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
  onSaveTelegramAlertSettings,
  companionProfile,
  onUpdateCompanionProfile,
  userId,
  onRecovered,
}: SettingsModalProps) {
  const [localTgEnabled, setLocalTgEnabled] = React.useState(
    telegramAlertsEnabled,
  );
  const [localTgSlots, setLocalTgSlots] =
    React.useState<string[]>(telegramAlertSlots);
    
  const [mobileView, setMobileView] = React.useState<"list" | "detail">("list");

  React.useEffect(() => {
    if (isOpen) {
      setLocalTgEnabled(telegramAlertsEnabled);
      setLocalTgSlots(telegramAlertSlots);
      setMobileView("list");
    }
  }, [isOpen, telegramAlertsEnabled, telegramAlertSlots]);

  if (!isOpen) return null;

  const handleTabSelect = (tab: SettingsTab) => {
    setActiveTab(tab);
    setMobileView("detail");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center z-[200] overflow-hidden bg-zinc-50 dark:bg-[#0a0a0a]">
        {/* Dialog Content - Full Screen Discord Style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative z-10 bg-zinc-50 dark:bg-[#0a0a0a] w-full h-full max-w-full rounded-none flex flex-col md:flex-row overflow-hidden border-0"
        >
          {/* Left Sidebar (Desktop) / Native List (Mobile) */}
          <div className={`w-full md:w-64 bg-zinc-100/50 dark:bg-[#121212] flex-shrink-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-y-auto ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}>
            <div className="flex items-center justify-between p-4 md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0a0a0a] sticky top-0 z-10">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Settings</span>
              <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 md:p-4 space-y-6 md:space-y-1">
              <div className="space-y-2 md:space-y-1">
                <h2 className="px-3 text-xs md:text-[11px] font-semibold md:font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 md:mb-2 md:mt-2">
                  Configuration
                </h2>
                <div className="bg-white dark:bg-[#0a0a0a] md:bg-transparent rounded-2xl md:rounded-none overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 md:border-0 shadow-sm md:shadow-none divide-y divide-zinc-100 dark:divide-zinc-800/50 md:divide-none">
                  <button
                    onClick={() => handleTabSelect("api")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "api"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-indigo-50 md:bg-transparent text-indigo-600 md:text-inherit flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      AI Engine
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                  <button
                    onClick={() => handleTabSelect("telegram")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "telegram"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-[#24A1DE]/10 md:bg-transparent text-[#24A1DE] md:text-inherit flex items-center justify-center shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      Telegram
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                  <button
                    onClick={() => handleTabSelect("workspace")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "workspace"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-orange-50 md:bg-transparent text-orange-600 md:text-inherit flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      Google Workspace
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 md:space-y-1">
                <h2 className="px-3 text-xs md:text-[11px] font-semibold md:font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1 md:mb-2 md:mt-4">
                  Behavior & OS
                </h2>
                <div className="bg-white dark:bg-[#0a0a0a] md:bg-transparent rounded-2xl md:rounded-none overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 md:border-0 shadow-sm md:shadow-none divide-y divide-zinc-100 dark:divide-zinc-800/50 md:divide-none">
                  <button
                    onClick={() => handleTabSelect("memory")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "memory"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-emerald-50 md:bg-transparent text-emerald-600 md:text-inherit flex items-center justify-center shrink-0">
                        <Brain className="w-4 h-4" />
                      </div>
                      AI Memory
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                  <button
                    onClick={() => handleTabSelect("companion")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "companion"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-amber-50 md:bg-transparent text-amber-600 md:text-inherit flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      Coach Persona
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                  <button
                    onClick={() => handleTabSelect("recovery")}
                    className={`w-full flex items-center justify-between md:justify-start gap-3 px-4 md:px-3 py-3.5 md:py-2.5 md:rounded-lg text-[15px] md:text-sm font-medium md:font-semibold transition-colors ${
                      activeTab === "recovery"
                        ? "md:bg-white md:dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 md:shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 md:text-zinc-600 md:dark:text-zinc-400 hover:bg-zinc-50 md:hover:bg-zinc-200/50 dark:hover:bg-zinc-900 md:dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 md:w-auto md:h-auto rounded-lg bg-rose-50 md:bg-transparent text-rose-600 md:text-inherit flex items-center justify-center shrink-0">
                        <HeartHandshake className="w-4 h-4" />
                      </div>
                      Recovery System
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-300 md:hidden" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area (Detail View) */}
          <div className={`flex-1 bg-white dark:bg-[#0a0a0a] relative flex flex-col h-full overflow-y-auto ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
            <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-[#0a0a0a] z-20">
              <button onClick={() => setMobileView("list")} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium -ml-2 p-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Settings
              </button>
            </div>
            <button
              onClick={onClose}
              className="hidden md:flex absolute top-8 right-8 p-2 rounded-full border-2 border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex-col items-center gap-1 group z-10"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Esc
              </span>
            </button>

            <div className="max-w-2xl w-full mx-auto px-6 py-8 md:px-8 md:py-12 pb-24">
              <AnimatePresence mode="wait">
                {activeTab === "api" && (
                  <motion.div
                    key="api-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div>
                      <h3 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2">
                        Gemini Configuration
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Provide your private Google Gemini API key to run
                        client-side planner algorithms, syllabus analysis,
                        real-time voice bridges, and interactive copilot
                        queries.
                      </p>
                    </div>

                    <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide font-mono flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                        Secure Local Storage
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Keys are locked to your authenticated session. They are
                        encrypted within your cloud profile so you never have to
                        re-enter them when changing devices.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Gemini API Key
                      </label>
                      <input
                        type="password"
                        value={settingsKeyInput}
                        onChange={(e) => setSettingsKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3.5 font-mono text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                        <span>Don't have an API key?</span>
                        <a
                          href="https://ai.google.dev/gemini-api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          Get one for free at Google AI Studio
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="pt-6 mt-8 border-t border-zinc-200 dark:border-zinc-700/50 flex justify-end">
                      <button
                        onClick={onSaveSettings}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm shadow-md"
                      >
                        Save API Key
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === "telegram" && (
                  <motion.div
                    key="telegram-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div>
                      <h3 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2">
                        Telegram Integration
                      </h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Connect your Saarthi account to a Telegram bot for
                        mobile access, push alerts, and rapid voice note dumps.
                      </p>
                    </div>

                    {telegramChatId ? (
                      /* Connected state */
                      <div className="space-y-8">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold tracking-wider text-emerald-800 dark:text-emerald-400 uppercase flex items-center gap-2 font-mono">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              Companion Linked
                            </span>
                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display break-all">
                              {telegramUsername
                                ? `@${telegramUsername}`
                                : `Chat ID: ${telegramChatId}`}
                            </p>
                          </div>
                          <button
                            onClick={onUnlinkTelegram}
                            className="w-full md:w-auto text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                          >
                            Disconnect Bot
                          </button>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                              Notification Settings
                            </h4>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl gap-4">
                              <div>
                                <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block mb-1">
                                  Critical Risk Push Alerts
                                </label>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Receive urgent telegram messages when
                                  deadlines are near.
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  setLocalTgEnabled(!localTgEnabled)
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                                  localTgEnabled
                                    ? "bg-indigo-500"
                                    : "bg-zinc-300 dark:bg-zinc-600"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    localTgEnabled
                                      ? "translate-x-6"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl space-y-4">
                            <div>
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                                Focus Preferences (Quiet Hours)
                              </h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                                Silence all ambient Telegram updates to safeguard rest or high-intensity focus.
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-2 tracking-wider">
                                    Silence From
                                  </label>
                                  <input
                                    type="time"
                                    defaultValue="22:00"
                                    className="w-full text-sm p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-2 tracking-wider">
                                    Silence Until
                                  </label>
                                  <input
                                    type="time"
                                    defaultValue="08:00"
                                    className="w-full text-sm p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl space-y-4">
                            <div>
                              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block mb-1">
                                Daily Digest Schedule
                              </label>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Configure up to 3 times to receive automated
                                briefings of your active tasks and risks.
                              </p>
                            </div>

                            <div className="space-y-3">
                              {localTgSlots.map((slot, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3"
                                >
                                  <input
                                    type="time"
                                    value={slot}
                                    onChange={(e) => {
                                      const newSlots = [...localTgSlots];
                                      newSlots[idx] = e.target.value;
                                      setLocalTgSlots(newSlots);
                                    }}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none text-zinc-900 dark:text-zinc-100"
                                  />
                                  <button
                                    onClick={() => {
                                      const newSlots = [...localTgSlots];
                                      newSlots.splice(idx, 1);
                                      setLocalTgSlots(newSlots);
                                    }}
                                    className="p-2 text-zinc-400 hover:text-rose-500 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-rose-500 dark:hover:border-rose-500 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              {localTgSlots.length < 3 && (
                                <button
                                  onClick={() =>
                                    setLocalTgSlots([...localTgSlots, "10:00"])
                                  }
                                  className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  + Add Time Slot
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                onSaveTelegramAlertSettings(
                                  localTgEnabled,
                                  localTgSlots,
                                );
                                triggerToast(
                                  "Telegram notification settings saved.",
                                );
                              }}
                              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm shadow-md"
                            >
                              Save Preferences
                            </button>
                          </div>
                        </div>

                        <div className="p-5 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                              <Send className="w-4 h-4 text-zinc-500" />
                              Trigger Live Sync Briefing
                            </h4>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              Send an immediate AI summary of your urgent tasks
                              to Telegram right now.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              onTriggerBriefing();
                              triggerToast(
                                "Manual briefing dispatched to Telegram.",
                              );
                            }}
                            className="w-full md:w-auto bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-2.5 px-5 rounded-lg text-sm cursor-pointer transition-colors"
                          >
                            Send Briefing
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Disconnected state */
                      <div className="space-y-6">
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/50 rounded-xl space-y-6">
                          {!telegramCode ? (
                            <div className="text-center space-y-4">
                              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Bot className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                                  Generate Link Code
                                </h4>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                                  Generate a temporary pairing code. Send this
                                  code to the Telegram bot to securely link your
                                  account.
                                </p>
                              </div>
                              <button
                                onClick={onGenerateLinkCode}
                                disabled={isGeneratingTelegramCode}
                                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors cursor-pointer shadow-md inline-flex items-center justify-center gap-2"
                              >
                                {isGeneratingTelegramCode ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Key className="w-5 h-5" />
                                )}
                                {isGeneratingTelegramCode
                                  ? "Generating..."
                                  : "Generate Code"}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              <div className="text-center">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-widest font-mono">
                                  Your Temporary Code
                                </h4>
                                <div className="inline-flex items-center gap-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-6 py-4 rounded-xl">
                                  <span className="text-3xl font-black tracking-[0.2em] font-mono text-zinc-900 dark:text-zinc-100">
                                    {telegramCode}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        telegramCode,
                                      );
                                      triggerToast("Code copied to clipboard!");
                                    }}
                                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                                    title="Copy Code"
                                  >
                                    <Clipboard className="w-5 h-5" />
                                  </button>
                                </div>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-3 animate-pulse">
                                  Expires in 5 minutes
                                </p>
                              </div>

                              <div className="space-y-4 bg-zinc-100 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                <h5 className="font-bold text-zinc-900 dark:text-zinc-100 text-center">
                                  Next Steps:
                                </h5>
                                <ol className="max-w-sm mx-auto space-y-4">
                                  <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">
                                      1
                                    </span>
                                    <span>
                                      Open Telegram and search for{" "}
                                      <strong className="text-zinc-900 dark:text-zinc-100">
                                        @SaarthiAI_Bot
                                      </strong>{" "}
                                      (or click below).
                                    </span>
                                  </li>
                                  <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">
                                      2
                                    </span>
                                    <span>
                                      Send the command:{" "}
                                      <code className="bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-900 dark:text-zinc-100 font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                                        /link {telegramCode}
                                      </code>
                                    </span>
                                  </li>
                                  <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">
                                      3
                                    </span>
                                    <span>
                                      Wait for the confirmation message in
                                      Telegram. You will see a success status
                                      here immediately.
                                    </span>
                                  </li>
                                </ol>
                              </div>

                              <div className="flex justify-center pt-2">
                                <a
                                  href="https://t.me/SaarthiAI_Bot" // Replace with your actual bot link if known
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full md:w-auto bg-[#24A1DE] hover:bg-[#1E8CC0] text-white font-bold py-3 px-8 rounded-lg transition-colors inline-flex justify-center items-center gap-2 shadow-md"
                                >
                                  <ExternalLink className="w-5 h-5" />
                                  Open Telegram Bot
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                
                {activeTab === "workspace" && (
                  <motion.div
                    key="workspace-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="max-w-2xl"
                  >
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-50 tracking-tight">
                        Google Workspace
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Connect your schedule directly to Saarthi.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden p-6 md:p-8 space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">
                            Connect Google Calendar & Tasks
                          </h3>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                            Integrate your Google Calendar and Google Tasks to enable automatic schedule syncing, conflict detection, and smart task management directly from your dashboard.
                          </p>
                          <button
                            onClick={() => {
                              const SCOPES = [
                                "https://www.googleapis.com/auth/calendar",
                                "https://www.googleapis.com/auth/tasks"
                              ];
                              window.location.href = `/_proxy/oauth/login?scopes=${encodeURIComponent(SCOPES.join(","))}&redirect_uri=${encodeURIComponent(window.location.origin)}`;
                            }}
                            className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                          >
                            <Calendar className="w-5 h-5" />
                            Connect via Google
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "companion" && (
                  <motion.div
                    key="companion-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <CompanionCenter
                      profile={companionProfile}
                      onUpdateProfile={onUpdateCompanionProfile}
                      inline={true}
                    />
                  </motion.div>
                )}

                {activeTab === "memory" && (
                  <motion.div
                    key="memory-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    {userId ? (
                      <LearningCenter
                        userId={userId}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Brain className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          Sign in required
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                          You must be logged in to view AI Memory.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "recovery" && (
                  <motion.div
                    key="recovery-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    {userId ? (
                      <RecoveryCenter
                        userId={userId}
                        onRecovered={onRecovered}
                        inline={true}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20">
                        <HeartHandshake className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          Sign in required
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                          You must be logged in to use Recovery OS.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
