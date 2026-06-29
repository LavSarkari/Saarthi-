import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Mic,
  MicOff,
  Image as ImageIcon,
  HelpCircle,
  RefreshCw,
  Search,
  ExternalLink,
  MessageSquare,
  Compass,
  Flame,
  Globe,
  Brain,
  Download,
  AlertTriangle,
  ChevronDown,
  Send,
  TrendingUp,
  Bot,
  Volume2,
  VolumeX,
  Settings,
  Signal,
  Clock,
  Activity,
  CheckCircle
} from "lucide-react";
import { ChatMessage } from "../types";

interface AssistantPanelProps {
  activeTab: "chat" | "voice" | "poster" | "help";
  setActiveTab: (tab: "chat" | "voice" | "poster" | "help") => void;
  chatPersona: "shield" | "navigator" | "coach";
  setChatPersona: (persona: "shield" | "navigator" | "coach") => void;
  enableGrounding: boolean;
  setEnableGrounding: (val: boolean) => void;
  enableThinking: boolean;
  setEnableThinking: (val: boolean) => void;
  chats: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isChatSending: boolean;
  chatSources: any[];
  onSendChatMessage: () => Promise<void> | void;
  isLiveActive: boolean;
  liveLog: string;
  onStartLiveCall: () => Promise<void> | void;
  imagePrompt: string;
  setImagePrompt: (val: string) => void;
  imageSize: "1K" | "2K" | "4K";
  setImageSize: (val: "1K" | "2K" | "4K") => void;
  isGeneratingImg: boolean;
  onGeneratePoster: () => Promise<void> | void;
  generatedImg: string | null;
  triggerToast: (msg: string) => void;
  
  // Rebuilt Voice engine optional props
  liveState?: "idle" | "initializing" | "connecting" | "listening" | "processing" | "speaking" | "interrupted" | "disconnected" | "reconnecting" | "error";
  liveErrorMessage?: string;
  userTranscript?: string;
  modelTranscript?: string;
  micVolume?: number;
  playbackVolume?: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  latencyMs?: number;
  connectionQuality?: "excellent" | "good" | "fair" | "poor";
  conversationDuration?: number;
  availableMics?: MediaDeviceInfo[];
  availableSpeakers?: MediaDeviceInfo[];
  selectedMicId?: string;
  selectedSpeakerId?: string;
  onSelectMic?: (deviceId: string) => void;
  onSelectSpeaker?: (deviceId: string) => void;
}

export default function AssistantPanel({
  activeTab,
  setActiveTab,
  chatPersona,
  setChatPersona,
  enableGrounding,
  setEnableGrounding,
  enableThinking,
  setEnableThinking,
  chats,
  chatInput,
  setChatInput,
  isChatSending,
  chatSources,
  onSendChatMessage,
  isLiveActive,
  liveLog,
  onStartLiveCall,
  imagePrompt,
  setImagePrompt,
  imageSize,
  setImageSize,
  isGeneratingImg,
  onGeneratePoster,
  generatedImg,
  triggerToast,
  
  liveState = "idle",
  liveErrorMessage = "",
  userTranscript = "",
  modelTranscript = "",
  micVolume = 0,
  playbackVolume = 0,
  isMuted = false,
  onToggleMute,
  latencyMs = 0,
  connectionQuality = "excellent",
  conversationDuration = 0,
  availableMics = [],
  availableSpeakers = [],
  selectedMicId = "",
  selectedSpeakerId = "",
  onSelectMic,
  onSelectSpeaker
}: AssistantPanelProps) {
  // Chat list scroll ref
  const scrollParentRef = React.useRef<HTMLDivElement>(null);
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = React.useState(false);
  const [isMicDropdownOpen, setIsMicDropdownOpen] = React.useState(false);
  const [isSpeakerDropdownOpen, setIsSpeakerDropdownOpen] = React.useState(false);

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  React.useEffect(() => {
    if (scrollParentRef.current) {
      scrollParentRef.current.scrollTo({
        top: scrollParentRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chats, isChatSending, userTranscript, modelTranscript]);

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 overflow-hidden h-full transition-all">
      {/* Tab bar header */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-1 shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 px-2 text-xs font-semibold text-center m-0.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer border ${
            activeTab === "chat"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 shadow-xs font-bold"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Chat AI</span>
        </button>

        <button
          onClick={() => setActiveTab("voice")}
          className={`flex-1 py-2.5 px-2 text-xs font-semibold text-center m-0.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer border ${
            activeTab === "voice"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 shadow-xs font-bold"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Live Audio</span>
        </button>

        <button
          onClick={() => setActiveTab("poster")}
          className={`flex-1 py-2.5 px-2 text-xs font-semibold text-center m-0.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer border ${
            activeTab === "poster"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 shadow-xs font-bold"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Visualizer</span>
        </button>

        <button
          onClick={() => setActiveTab("help")}
          className={`p-2.5 text-xs rounded-lg m-0.5 flex items-center justify-center transition-colors duration-200 cursor-pointer border ${
            activeTab === "help"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 shadow-xs font-bold"
              : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
          title="Saarthi FAQ Center"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs panels */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-zinc-900">
        {/* PANEL 1: AI Multi-turn Chat */}
        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Context control line */}
            <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border-b border-zinc-200 dark:border-zinc-800 p-3 text-xs flex flex-wrap items-center justify-between gap-3 text-zinc-700 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 dark:text-zinc-500 font-bold font-mono text-[10px] uppercase">COACH STYLE</span>
                <div className="relative z-10">
                  <button
                    onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                    className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-semibold cursor-pointer min-w-[170px]"
                  >
                    <span>
                      {chatPersona === "navigator" ? "Calm Strategic Navigator" : chatPersona === "shield" ? "Procrastination Shield" : "Tough Love Taskmaker"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-400" />
                  </button>
                  {isPersonaDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0" 
                        onClick={() => setIsPersonaDropdownOpen(false)}
                      ></div>
                      <div className="absolute left-0 mt-1 w-full min-w-[170px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-20 py-1 overflow-hidden font-medium">
                        <button
                          onClick={() => { setChatPersona("navigator"); setIsPersonaDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${chatPersona === "navigator" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                        >
                          Calm Strategic Navigator
                        </button>
                        <button
                          onClick={() => { setChatPersona("shield"); setIsPersonaDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${chatPersona === "shield" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                        >
                          Procrastination Shield
                        </button>
                        <button
                          onClick={() => { setChatPersona("coach"); setIsPersonaDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${chatPersona === "coach" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                        >
                          Tough Love Taskmaker
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[9px] font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={enableGrounding}
                    onChange={(e) => setEnableGrounding(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 accent-zinc-950 dark:accent-zinc-50"
                  />
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-zinc-400 dark:text-zinc-500" /> Web Search
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors" title="Deep reasoning thinking block">
                  <input
                    type="checkbox"
                    checked={enableThinking}
                    onChange={(e) => setEnableThinking(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 accent-zinc-950 dark:accent-zinc-50"
                  />
                  <span className="flex items-center gap-1">
                    <Brain className="w-3 h-3 text-zinc-400 dark:text-zinc-500" /> High Thinking
                  </span>
                </label>
              </div>
            </div>

            {/* Live voice connection status banner inside chat tab */}
            {isLiveActive && (
              <div className="bg-cyan-50/60 dark:bg-cyan-950/20 border-b border-cyan-100/80 dark:border-cyan-950/40 px-3.5 py-2 flex items-center justify-between text-xs animate-fade-in shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    liveState === "speaking" ? "bg-cyan-500 animate-pulse shadow-[0_0_6px_rgb(6,182,212)]" :
                    liveState === "listening" ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgb(16,185,129)]" :
                    "bg-amber-500 animate-bounce"
                  }`} />
                  <span className="font-bold text-cyan-800 dark:text-cyan-300 font-mono text-[10px] uppercase tracking-wider">
                    Saarthi Voice: {liveState === "speaking" ? "Speaking" : liveState === "listening" ? "Listening" : "Thinking"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(conversationDuration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Signal className="w-3 h-3" />
                    {latencyMs}ms
                  </span>
                </div>
              </div>
            )}

             {/* Chat Messages Scrolling stream */}
            <div ref={scrollParentRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {chats.length === 0 && (!userTranscript || !userTranscript.trim()) ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3.5 my-8">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-50">Saarthi Study Companion</p>
                    <p className="text-[11px] text-zinc-550 dark:text-zinc-400 max-w-[280px] leading-relaxed">
                      "I'm feeling blocked starting this essay, how do I begin?" or "Give me a checklist to study chapter 4."
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chats.map((c, idx) => {
                    const isUser = c.role === "user";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-fade-in`}
                      >
                        <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-505 uppercase tracking-wide mb-1 px-1">
                          {isUser ? "You" : `${chatPersona.toUpperCase()} COACH`}
                        </span>
                        <div
                          className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                            isUser
                              ? "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-tr-none animate-slide-in-right"
                              : "bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none animate-slide-in-left"
                          }`}
                        >
                          {c.text}
                        </div>
                      </div>
                    );
                  })}

                  {/* Real-time speaking transcript preview */}
                  {isLiveActive && userTranscript && userTranscript.trim() !== "" && (
                    <div className="flex flex-col items-end animate-fade-in">
                      <span className="text-[9px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide mb-1 px-1 flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                        </span>
                        Speaking...
                      </span>
                      <div className="p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap bg-cyan-500/5 dark:bg-cyan-950/20 border border-dashed border-cyan-500/30 text-zinc-700 dark:text-zinc-300 rounded-tr-none shadow-xs animate-pulse">
                        {userTranscript}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Citations citation block */}
              {chatSources.length > 0 && (
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/20 dark:border-emerald-900/30 rounded-2xl space-y-2 animate-fade-in text-xs">
                  <span className="text-[9px] font-mono font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-500" /> Verified Search Results
                  </span>
                  <div className="flex flex-col gap-1.5 pl-0.5">
                    {chatSources.map((link, idx) => {
                      const url = link.web?.uri || "#";
                      const title = link.web?.title || url;
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:underline font-medium truncate flex items-center gap-1.5"
                        >
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{idx + 1}.</span>
                          <span className="truncate">{title}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {isChatSending && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-1">
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-700 dark:text-zinc-300" />
                  <span className="font-medium animate-pulse">Formulating tactical guidelines...</span>
                </div>
              )}
            </div>

            {/* Chat bottom input bar */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/50 dark:bg-zinc-950/10 flex gap-2 shrink-0">
              <div className="relative flex-grow flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isChatSending && chatInput.trim() && onSendChatMessage()}
                  placeholder={isLiveActive ? "Voice active. Speak clearly or type..." : "Message your strategic companion..."}
                  className="input-primary w-full py-2.5 pr-11"
                  disabled={isChatSending}
                />
                
                {/* Voice Session toggle inside text box */}
                <button
                  type="button"
                  onClick={onStartLiveCall}
                  className={`absolute right-2 p-1.5 rounded-lg cursor-pointer transition-all ${
                    isLiveActive
                      ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-sm"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  title={isLiveActive ? "End Live Voice Connection" : "Start Live Voice Connection"}
                >
                  {isLiveActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={onSendChatMessage}
                disabled={isChatSending || !chatInput.trim()}
                className="btn-primary py-2.5 px-4.5 shrink-0"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* PANEL 2: Real-time Live Audio Duplex Session */}
        {activeTab === "voice" && (
          <div className="flex-1 flex flex-col p-5 space-y-4 overflow-y-auto">
            {/* Connection/State Header */}
            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 p-3 rounded-2xl shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  liveState === "speaking" ? "bg-cyan-500 animate-pulse shadow-[0_0_8px_rgb(6,182,212)]" :
                  liveState === "listening" ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgb(16,185,129)]" :
                  liveState === "processing" ? "bg-amber-500 animate-bounce" :
                  liveState === "connecting" || liveState === "initializing" ? "bg-blue-500 animate-pulse" :
                  liveState === "error" ? "bg-rose-500" : "bg-zinc-400"
                }`} />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-700 dark:text-zinc-300">
                  {liveState === "idle" && "Ready to Connect"}
                  {liveState === "initializing" && "Initializing Core..."}
                  {liveState === "connecting" && "Bridging Connection..."}
                  {liveState === "listening" && "Listening..."}
                  {liveState === "processing" && "Thinking..."}
                  {liveState === "speaking" && "Saarthi Speaking"}
                  {liveState === "interrupted" && "Interrupted"}
                  {liveState === "disconnected" && "Session Closed"}
                  {liveState === "error" && "Engine Fault"}
                </span>
              </div>

              {isLiveActive && (
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(conversationDuration)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Signal className="w-3 h-3" />
                    <span>{latencyMs}ms</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message banner */}
            {liveState === "error" && liveErrorMessage && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 p-3 rounded-2xl flex items-start gap-2.5 text-left text-xs text-rose-800 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Execution Error</p>
                  <p className="opacity-90">{liveErrorMessage}</p>
                </div>
              </div>
            )}

            {/* Main Interactive Stage */}
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-100 dark:border-zinc-800/40 rounded-3xl p-6 relative overflow-hidden min-h-[160px] shrink-0">
              {/* Dynamic Live Visualization Wave */}
              {isLiveActive ? (
                <div className="flex flex-col items-center justify-center space-y-6 w-full">
                  {/* Orbs and pulses */}
                  <div className="relative flex items-center justify-center w-20 h-20">
                    <motion.div
                      animate={{
                        scale: liveState === "speaking" ? [1, 1.1 + playbackVolume * 2, 1] : 
                               liveState === "listening" ? [1, 1.05 + micVolume * 1.5, 1] : 1,
                        opacity: liveState === "listening" ? 0.3 : 0.15
                      }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-cyan-400/20 dark:bg-cyan-500/10 blur-md"
                    />
                    
                    <button
                      onClick={onStartLiveCall}
                      className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 z-10 cursor-pointer"
                      title="End Session"
                    >
                      <MicOff className="w-5 h-5 animate-pulse" />
                    </button>
                  </div>

                  {/* Reactive Soundwave Graphic */}
                  <div className="w-full max-w-[200px] flex items-center justify-center gap-1 h-8">
                    {[...Array(15)].map((_, i) => {
                      const vol = liveState === "speaking" ? playbackVolume : liveState === "listening" ? micVolume : 0;
                      const baseFactor = 4 + Math.sin(i * 0.4) * 8;
                      const activeHeight = Math.max(4, Math.min(32, baseFactor + vol * 120 * (0.4 + Math.random() * 0.6)));
                      return (
                        <motion.div
                          key={i}
                          animate={{ height: activeHeight }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className={`w-1 rounded-full ${
                            liveState === "speaking" ? "bg-cyan-500 shadow-[0_0_6px_rgb(6,182,212)]" :
                            liveState === "listening" ? "bg-emerald-500 shadow-[0_0_6px_rgb(16,185,129)]" :
                            "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <button
                    onClick={onStartLiveCall}
                    className="w-16 h-16 rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Click to connect duplex voice stream</p>
                </div>
              )}
            </div>

            {/* Conversation Transcripts Panel */}
            {isLiveActive && (userTranscript || modelTranscript) && (
              <div className="border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl overflow-hidden max-h-[160px] flex flex-col bg-white dark:bg-zinc-950 shrink-0">
                <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
                  <span>LIVE CONVERSATION TRANSCRIPT</span>
                  <Activity className="w-3 h-3 text-cyan-500 animate-pulse" />
                </div>
                <div className="p-3 text-left space-y-2.5 overflow-y-auto text-xs leading-relaxed">
                  {userTranscript && (
                    <div className="space-y-0.5">
                      <span className="font-bold text-zinc-500 uppercase text-[9px] tracking-wider block">You</span>
                      <p className="text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-900/40">{userTranscript}</p>
                    </div>
                  )}
                  {modelTranscript && (
                    <div className="space-y-0.5">
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase text-[9px] tracking-wider block">Saarthi</span>
                      <p className="text-zinc-950 dark:text-zinc-50 font-medium bg-cyan-50/20 dark:bg-cyan-950/10 px-2.5 py-1.5 rounded-xl border border-cyan-100/30 dark:border-cyan-950/20">{modelTranscript}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audio Settings Control Panel */}
            <div className="space-y-3 bg-zinc-50/30 dark:bg-zinc-950/10 border border-zinc-200/50 dark:border-zinc-800/40 p-4 rounded-2xl text-left shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Audio Devices</span>
                </h4>
                
                {isLiveActive && onToggleMute && (
                  <button
                    onClick={onToggleMute}
                    className={`p-1 px-2 rounded-lg border flex items-center gap-1.5 text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                      isMuted
                        ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 text-rose-700"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{isMuted ? "Muted" : "Active"}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Microphone Input</label>
                  <div className="relative z-10">
                    <button
                      onClick={() => setIsMicDropdownOpen(!isMicDropdownOpen)}
                      className="w-full flex items-center justify-between text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl focus:outline-none hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-sm"
                    >
                      <span className="truncate">
                        {availableMics && availableMics.length > 0 && selectedMicId
                          ? availableMics.find(m => m.deviceId === selectedMicId)?.label || `Microphone ${selectedMicId.slice(0, 5)}`
                          : "Default System Microphone"}
                      </span>
                      <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0 ml-2" />
                    </button>
                    {isMicDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0" 
                          onClick={() => setIsMicDropdownOpen(false)}
                        ></div>
                        <div className="absolute left-0 bottom-full mb-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-20 py-1 overflow-hidden font-medium max-h-48 overflow-y-auto">
                          {availableMics && availableMics.length > 0 ? (
                            availableMics.map((mic) => (
                              <button
                                key={mic.deviceId}
                                onClick={() => { onSelectMic?.(mic.deviceId); setIsMicDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${selectedMicId === mic.deviceId ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                              >
                                {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
                              </button>
                            ))
                          ) : (
                            <button
                              onClick={() => { onSelectMic?.(""); setIsMicDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${!selectedMicId ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Default System Microphone
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Speaker Output</label>
                  <div className="relative z-10">
                    <button
                      onClick={() => setIsSpeakerDropdownOpen(!isSpeakerDropdownOpen)}
                      className="w-full flex items-center justify-between text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-xl focus:outline-none hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-sm"
                    >
                      <span className="truncate">
                        {availableSpeakers && availableSpeakers.length > 0 && selectedSpeakerId
                          ? availableSpeakers.find(s => s.deviceId === selectedSpeakerId)?.label || `Speaker ${selectedSpeakerId.slice(0, 5)}`
                          : "Default System Speaker"}
                      </span>
                      <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0 ml-2" />
                    </button>
                    {isSpeakerDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0" 
                          onClick={() => setIsSpeakerDropdownOpen(false)}
                        ></div>
                        <div className="absolute left-0 bottom-full mb-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-20 py-1 overflow-hidden font-medium max-h-48 overflow-y-auto">
                          {availableSpeakers && availableSpeakers.length > 0 ? (
                            availableSpeakers.map((spk) => (
                              <button
                                key={spk.deviceId}
                                onClick={() => { onSelectSpeaker?.(spk.deviceId); setIsSpeakerDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${selectedSpeakerId === spk.deviceId ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                              >
                                {spk.label || `Speaker ${spk.deviceId.slice(0, 5)}`}
                              </button>
                            ))
                          ) : (
                            <button
                              onClick={() => { onSelectSpeaker?.(""); setIsSpeakerDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${!selectedSpeakerId ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Default System Speaker
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: Image / Wallpaper Generator */}
        {activeTab === "poster" && (
          <div className="flex-grow p-5 space-y-4 overflow-y-auto">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                Productivity Motivation Visualizer
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Generate minimalist wallpaper backgrounds or visual cards to decorate your workspace or help center.
              </p>
            </div>

            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800/85 p-4 rounded-xl">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-500 font-bold">
                  Design prompt
                </label>
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="e.g. 'Cozy study loft desk under starry light, warm colors, ultra minimalist...'"
                  className="input-primary"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <span className="block text-[10px] font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-500 font-bold">Resolution</span>
                  <div className="flex gap-1.5">
                    {(["1K", "2K", "4K"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                          imageSize === size
                            ? "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent font-bold"
                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={onGeneratePoster}
                  disabled={isGeneratingImg || !imagePrompt.trim()}
                  className="btn-primary py-2 px-4 self-end"
                >
                  {isGeneratingImg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Poster...</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-3.5 h-3.5" />
                      <span>Compile Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {generatedImg && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 bg-zinc-50 dark:bg-zinc-950/25 space-y-3 animate-fade-in shadow-xs">
                <span className="text-[9px] font-mono text-emerald-800 dark:text-emerald-400 font-bold tracking-wider block uppercase">Compiled poster result</span>
                <img
                  src={generatedImg}
                  alt="compiled background poster illustration"
                  className="w-full object-cover rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-[300px]"
                  referrerPolicy="no-referrer"
                />
                <a
                  href={generatedImg}
                  download="saarthi-motivation-poster.png"
                  className="btn-secondary w-full py-2"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>Download Image Asset</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* PANEL 4: Help Instructions & FAQs */}
        {activeTab === "help" && (
          <div className="flex-grow p-6 space-y-5 overflow-y-auto leading-relaxed text-xs text-zinc-600 dark:text-zinc-400">
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100 uppercase">Strategic Help Center</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                Saarthi operates on execution-first modeling, mitigating deadline panic through early structural planning.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/25 rounded-xl border border-zinc-200/50 dark:border-zinc-800/60 space-y-1.5">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> How is Risk Zone Computed?
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Our predictive engine evaluates remaining time, total effort remaining, completion metrics across subtasks, and known block patterns to dynamically score tasks. Active the "Formulate Rescue Plan" option when risk registers high to descale pressure.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/25 rounded-xl border border-zinc-200/50 dark:border-zinc-800/60 space-y-1.5">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> Google Calendar Blocking
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Connecting to calendar locks work sprints into your day, blocking out active focus hours to ensure deliverable milestones are met.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/25 rounded-xl border border-zinc-200/50 dark:border-zinc-800/60 space-y-1.5">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> Telegram Commands
                </h4>
                <div className="text-zinc-500 dark:text-zinc-400 text-[11px] space-y-1 font-mono">
                  <p><span className="font-bold">/start</span> - Boot and greet the companion</p>
                  <p><span className="font-bold">/link [code]</span> - Pair workspace profile</p>
                  <p><span className="font-bold">/briefing</span> - Fetch personalized visual roadmap</p>
                  <p><span className="font-bold">/tasks</span> - Check pending execution deadlines</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
