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
  Send,
  TrendingUp,
  Bot
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
  triggerToast
}: AssistantPanelProps) {
  // Chat list scroll ref
  const scrollParentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollParentRef.current) {
      scrollParentRef.current.scrollTo({
        top: scrollParentRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chats, isChatSending]);

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm h-full min-h-[600px] transition-all">
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
          <span>Chat Copilot</span>
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
            <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border-b border-zinc-200 dark:border-zinc-800 p-3 text-xs flex flex-wrap items-center justify-between gap-3 text-zinc-700 dark:text-zinc-350">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 dark:text-zinc-500 font-bold font-mono text-[10px] uppercase">COACH STYLE</span>
                <select
                  value={chatPersona}
                  onChange={(e) => setChatPersona(e.target.value as any)}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-semibold cursor-pointer"
                >
                  <option value="navigator">Calm Strategic Navigator</option>
                  <option value="shield">Procrastination Shield</option>
                  <option value="coach">Tough Love Taskmaker</option>
                </select>
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

            {/* Chat Messages Scrolling stream */}
            <div ref={scrollParentRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {chats.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3.5 my-8">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-50">Saarthi Study Companion</p>
                    <p className="text-[11px] text-zinc-505 dark:text-zinc-400 max-w-[280px] leading-relaxed">
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
                        <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1 px-1">
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
                          className="text-zinc-700 dark:text-zinc-350 hover:text-zinc-950 dark:hover:text-zinc-50 hover:underline font-medium truncate flex items-center gap-1.5"
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
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isChatSending && chatInput.trim() && onSendChatMessage()}
                placeholder="Message your strategic companion..."
                className="input-primary flex-grow py-2.5"
                disabled={isChatSending}
              />
              <button
                onClick={onSendChatMessage}
                disabled={isChatSending || !chatInput.trim()}
                className="btn-primary py-2.5 px-4.5"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* PANEL 2: Real-time Live Audio Duplex Session */}
        {activeTab === "voice" && (
          <div className="flex-1 flex flex-col p-8 items-center justify-center text-center space-y-6">
            <div className="relative flex items-center justify-center h-40">
              {/* Pulsing visual circles */}
              <AnimatePresence>
                {isLiveActive && (
                  <>
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0.3 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                      className="absolute w-36 h-36 rounded-full bg-zinc-200 dark:bg-zinc-800"
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0.4 }}
                      animate={{ scale: 1.25, opacity: 0 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: 0.7 }}
                      className="absolute w-28 h-28 rounded-full bg-zinc-100 dark:bg-zinc-800/60"
                    />
                  </>
                )}
              </AnimatePresence>

              <button
                onClick={onStartLiveCall}
                className={`w-20 h-20 rounded-full flex items-center justify-center z-10 transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
                  isLiveActive
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-rose-950/45 hover:bg-rose-600"
                    : "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200"
                }`}
                title={isLiveActive ? "Disconnect Voice Session" : "Start Live Voice Chat"}
              >
                {isLiveActive ? <MicOff className="w-6 h-6 animate-pulse" /> : <Mic className="w-6 h-6 text-white dark:text-zinc-950" />}
              </button>
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">Duplex Voice Interface</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Connect directly with our <strong>gemini-3.1-flash-live-preview</strong> model to brainstorm assignments, get tactical schedule reviews, or resolve blocking friction without typing.
              </p>
            </div>

            {/* Live session connection status badging */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold transition-all ${
              isLiveActive
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-400"
                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? "bg-emerald-500 animate-ping" : "bg-zinc-400"}`} />
              <span>{liveLog.toUpperCase()}</span>
            </div>

            {/* Live Waveform Indicator Canvas simulation */}
            {isLiveActive && (
              <div className="w-full max-w-[240px] flex items-center justify-center gap-1.5 h-12 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800/80 p-3 rounded-xl">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-150 animate-pulse"
                    style={{
                      height: `${Math.floor(Math.random() * 26) + 4}px`,
                      animationDelay: `${i * 80}ms`
                    }}
                  />
                ))}
              </div>
            )}
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
