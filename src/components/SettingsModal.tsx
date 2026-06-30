import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings, X, Key, MessageSquare, ShieldAlert, Clipboard, Check, Send,
  ExternalLink, Bot, Zap, CheckCircle, HelpCircle, RefreshCw, LogOut,
  HeartHandshake, Brain, Calendar, Menu, Search, ChevronRight
} from "lucide-react";
import CompanionCenter from "./CompanionCenter";
import RecoveryCenter from "./RecoveryCenter";
import LearningCenter from "./LearningCenter";
import { CompanionProfile } from "../types";

export type SettingsTab = string;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  companionProfile: CompanionProfile | null;
  onUpdateCompanionProfile: (updates: Partial<CompanionProfile>) => Promise<void>;
  userId: string | null;
  onRecovered: () => void;
}

const SIDEBAR_SECTIONS = [
  {
    title: "ACCOUNT",
    items: [
      { id: "profile", label: "Profile" },
      { id: "appearance", label: "Appearance" },
      { id: "notifications", label: "Notifications" }
    ]
  },
  {
    title: "AI CONFIGURATION",
    items: [
      { id: "api", label: "AI Engine" },
      { id: "memory", label: "AI Memory" },
      { id: "companion", label: "Coach Persona" }
    ]
  },
  {
    title: "INTEGRATIONS",
    items: [
      { id: "telegram", label: "Telegram" },
      { id: "workspace", label: "Google Workspace" },
    ]
  },
  {
    title: "EXECUTION SYSTEM",
    items: [
      { id: "recovery", label: "Recovery OS" },
      { id: "behavioral", label: "Behavioral Intelligence" },
      { id: "adaptive", label: "Adaptive Planning" },
      { id: "activation", label: "Activation Engine" }
    ]
  },
  {
    title: "PRODUCTIVITY",
    items: [
      { id: "focus", label: "Focus Sessions" },
      { id: "daily", label: "Daily Brief" },
      { id: "evening", label: "Evening Reflection" }
    ]
  },
  {
    title: "DATA",
    items: [
      { id: "privacy", label: "Privacy" },
      { id: "export", label: "Export Data" },
      { id: "reset", label: "Reset Learning" },
      { id: "delete", label: "Delete Account" }
    ]
  },
  {
    title: "ABOUT",
    items: [
      { id: "version", label: "Version" },
      { id: "docs", label: "Documentation" },
      { id: "github", label: "GitHub" },
      { id: "support", label: "Support" }
    ]
  }
];

export default function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen, onClose, activeTab, setActiveTab, settingsKeyInput, setSettingsKeyInput,
    onSaveSettings, telegramChatId, telegramUsername, onUnlinkTelegram,
    onTriggerBriefing, telegramCode, isGeneratingTelegramCode, onGenerateLinkCode,
    triggerToast, telegramAlertsEnabled, telegramAlertSlots, onSaveTelegramAlertSettings,
    companionProfile, onUpdateCompanionProfile, userId, onRecovered
  } = props;

  const [localTgEnabled, setLocalTgEnabled] = useState(telegramAlertsEnabled);
  const [localTgSlots, setLocalTgSlots] = useState<string[]>(telegramAlertSlots);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalTgEnabled(telegramAlertsEnabled);
      setLocalTgSlots(telegramAlertSlots);
      setSearchQuery("");
      setIsMobileSidebarOpen(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, telegramAlertsEnabled, telegramAlertSlots]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SIDEBAR_SECTIONS;
    const query = searchQuery.toLowerCase();
    return SIDEBAR_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => item.label.toLowerCase().includes(query))
    })).filter(section => section.items.length > 0);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleTabSelect = (id: string) => {
    setActiveTab(id);
    setIsMobileSidebarOpen(false);
    setSearchQuery("");
  };

  const getActiveTabLabel = () => {
    for (const section of SIDEBAR_SECTIONS) {
      const item = section.items.find(i => i.id === activeTab);
      if (item) return item.label;
    }
    return "Settings";
  };

  // Helper component for Empty States
  const EmptyState = ({ title }: { title: string }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h3 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          This feature is currently under development. Check back in a future update.
        </p>
      </div>
      <div className="p-8 bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
          <Settings className="w-6 h-6 animate-[spin_4s_linear_infinite]" />
        </div>
        <div>
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">Coming Soon</h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">We are polishing the experience.</p>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] overflow-hidden bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full h-full max-w-[1400px] flex flex-col md:flex-row overflow-hidden bg-zinc-50 dark:bg-[#0a0a0a]"
        >
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#0a0a0a] sticky top-0 z-20 shadow-sm">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors flex items-center gap-2"
            >
              <Menu className="w-5 h-5" />
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{getActiveTabLabel()}</span>
            </button>
            <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-900 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Area (Desktop & Mobile Drawer) */}
          <div className={`
            fixed inset-0 z-30 md:relative md:z-10 md:w-[280px] md:flex-shrink-0 md:h-full
            ${isMobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none md:pointer-events-auto"}
          `}>
            {/* Mobile Backdrop */}
            <div
              className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isMobileSidebarOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            
            {/* Sidebar Container */}
            <div className={`
              absolute left-0 top-0 bottom-0 md:relative md:w-full md:h-full
              w-[280px] bg-zinc-100/50 dark:bg-[#121212] md:border-r border-zinc-200 dark:border-zinc-800
              flex flex-col overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
              shadow-2xl md:shadow-none
            `}>
              <div className="p-4 pt-6 md:pt-8 sticky top-0 bg-zinc-100/95 dark:bg-[#121212]/95 backdrop-blur-xl z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 -ml-2 text-zinc-500 hidden md:flex hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Close Settings">
                      <X className="w-5 h-5" />
                    </button>
                    <span className="font-display font-bold text-lg text-zinc-900 dark:text-zinc-100">Settings</span>
                  </div>
                  <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 text-zinc-500 md:hidden hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search settings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-[#1a1a1a] text-zinc-900 dark:text-zinc-100 text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <div className="px-3 pb-8">
                {filteredSections.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-zinc-500">
                    No results found
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredSections.map((section, idx) => (
                      <div key={idx} className="space-y-1">
                        <h2 className="px-3 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                          {section.title}
                        </h2>
                        <div className="space-y-0.5">
                          {section.items.map(item => {
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleTabSelect(item.id)}
                                className={`
                                  w-full flex items-center justify-between px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium transition-all duration-200 group
                                  ${isActive 
                                    ? "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200"
                                  }
                                `}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Left Accent Indicator for Active Item */}
                                  <div className={`w-1 h-4 rounded-full transition-all duration-300 ${isActive ? "bg-indigo-500" : "bg-transparent group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600"}`} />
                                  {item.label}
                                </div>
                                {!isActive && <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-zinc-400 transition-opacity" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white dark:bg-[#0a0a0a] relative flex flex-col h-full overflow-y-auto">

            <div className="max-w-3xl w-full mx-auto px-6 py-6 md:py-0 md:pt-12 pb-32">
              {activeTab === "api" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2">
                      Gemini Configuration
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Provide your private Google Gemini API key to run
                      client-side planner algorithms, syllabus analysis,
                      real-time voice bridges, and interactive copilot queries.
                    </p>
                  </div>

                  <div className="p-5 bg-zinc-50 dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl space-y-2 shadow-sm">
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
                      Google Studio API Key
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Key className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={settingsKeyInput}
                        onChange={(e) => setSettingsKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="block w-full pl-12 pr-4 py-3.5 bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 shadow-sm focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 sm:text-sm transition-all outline-none"
                      />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                      Don't have one? Get it from{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                      >
                        Google AI Studio
                      </a>
                      .
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={onSaveSettings}
                      className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold py-3 px-8 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "telegram" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 tracking-tight">
                      Telegram Assistant
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                      Connect your account to receive alerts and manage tasks via Telegram.
                    </p>
                  </div>

                  {telegramChatId ? (
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] flex items-center justify-center shrink-0 shadow-lg relative">
                            <Send className="w-10 h-10 text-white ml-[-2px] mt-[2px]" />
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-4 border-white dark:border-[#121212]">
                              <Check className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="text-center md:text-left flex-1">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                              Connected to Telegram
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                              Your Saarthi account is successfully linked. The bot will send you personalized reminders and morning briefings based on your configurations.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 md:p-8 space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">Push Notifications</h4>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Receive smart alerts from Saarthi.</p>
                          </div>
                          <button
                            onClick={() => {
                              const newVal = !localTgEnabled;
                              setLocalTgEnabled(newVal);
                              onSaveTelegramAlertSettings(newVal, localTgSlots);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                              localTgEnabled ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                localTgEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col md:flex-row gap-3 justify-end items-center">
                        <button
                          onClick={onTriggerBriefing}
                          className="w-full md:w-auto px-6 py-2.5 rounded-lg font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                        >
                          Send Test Briefing
                        </button>
                        <button
                          onClick={onUnlinkTelegram}
                          className="w-full md:w-auto px-6 py-2.5 rounded-lg font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-sm"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden p-6 md:p-8 shadow-sm">
                      <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] flex items-center justify-center shrink-0 shadow-lg border-4 border-white dark:border-[#121212]">
                          <Send className="w-12 h-12 text-white ml-[-2px] mt-[2px]" />
                        </div>
                        <div className="max-w-sm">
                          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Connect Telegram</h3>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                            Receive daily briefings, actionable task nudges, and chat with your AI assistant on the go.
                          </p>
                          
                          {!telegramCode ? (
                            <button
                              onClick={onGenerateLinkCode}
                              disabled={isGeneratingTelegramCode}
                              className="w-full bg-[#24A1DE] hover:bg-[#1E8CC0] disabled:bg-[#24A1DE]/50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                            >
                              {isGeneratingTelegramCode ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Send className="w-5 h-5" />
                              )}
                              {isGeneratingTelegramCode ? "Generating..." : "Generate Link Code"}
                            </button>
                          ) : (
                            <div className="space-y-6 text-left w-full bg-zinc-50 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-inner">
                              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-500" /> Connection Ready
                              </h4>
                              <ol className="space-y-4">
                                <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">1</span>
                                  <span>Open the Saarthi Telegram Bot</span>
                                </li>
                                <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">2</span>
                                  <span>Send this command: <code className="block mt-2 bg-white dark:bg-black px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-indigo-600 dark:text-indigo-400 select-all text-base text-center font-bold tracking-wider shadow-sm">/link {telegramCode}</code></span>
                                </li>
                                <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">3</span>
                                  <span>Wait for the success message.</span>
                                </li>
                              </ol>
                              <a
                                href="https://t.me/SaarthiAI_Bot" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-[#24A1DE] hover:bg-[#1E8CC0] text-white font-bold py-3 px-8 rounded-lg transition-colors inline-flex justify-center items-center gap-2 shadow-md mt-2"
                              >
                                <ExternalLink className="w-5 h-5" />
                                Open Telegram Bot
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "workspace" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 tracking-tight">
                      Google Workspace
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                      Connect your schedule directly to Saarthi.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden p-6 md:p-8 space-y-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-orange-200/50 dark:border-orange-800/50">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">
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
                          className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 w-full md:w-auto shadow-md"
                        >
                          <Calendar className="w-5 h-5" />
                          Connect via Google
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "companion" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <CompanionCenter
                    profile={companionProfile}
                    onUpdateProfile={onUpdateCompanionProfile}
                    inline={true}
                  />
                </div>
              )}

              {activeTab === "memory" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {userId ? (
                    <LearningCenter userId={userId} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Brain className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-6" />
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Sign in required
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        You must be logged in to view AI Memory.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "recovery" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {userId ? (
                    <RecoveryCenter
                      userId={userId}
                      onRecovered={onRecovered}
                      inline={true}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <HeartHandshake className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-6" />
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Sign in required
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        You must be logged in to use Recovery OS.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Render Empty States for newly added items */}
              {!["api", "telegram", "workspace", "companion", "memory", "recovery"].includes(activeTab) && (
                <EmptyState title={getActiveTabLabel()} />
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
