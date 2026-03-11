import { useState } from "react";
import { User, Cpu, Clock, Settings, Brain } from "lucide-react";
import { ChessBoard } from "./ChessBoard";

interface NewGameTabProps {
  onStartGame: (config: any) => void;
}

export const NewGameTab = ({ onStartGame }: NewGameTabProps) => {
  const [whiteType, setWhiteType] = useState<"human" | "engine">("human");
  const [blackType, setBlackType] = useState<"human" | "engine">("engine");
  const [whitePlayer, setWhitePlayer] = useState("Player 1");
  const [blackPlayer, setBlackPlayer] = useState("Stockfish 18");
  
  const [timeControl, setTimeControl] = useState<"time" | "unlimited">("time");
  const [timeMinutes, setTimeMinutes] = useState(3);
  const [incrementSeconds, setIncrementSeconds] = useState(2);
  const [sameTimeControl, setSameTimeControl] = useState(true);

  const [rightPanelTab, setRightPanelTab] = useState<"config" | "engine">("config");

  return (
    <main className="flex-1 flex flex-row items-stretch p-0 bg-[#0a0a0a] overflow-hidden">
      
      {/* Left Side: Interactive Board */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center relative min-w-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="w-full max-w-[80vh] aspect-square rounded-md overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 relative z-10 mx-auto">
             <ChessBoard fen="start" orientation="white" />
          </div>
      </div>

      {/* Right Side: Tabbed Panel */}
      <div className="w-[450px] bg-[#121212] border-l border-white/5 flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
        
        {/* Top Tabs */}
        <div className="flex h-14 border-b border-white/5 bg-[#0a0a0a]">
            <button 
              onClick={() => setRightPanelTab("config")}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${rightPanelTab === "config" ? "text-white bg-[#121212] border-t-2 border-t-blue-500" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"}`}
            >
                <Settings size={16} /> Configuration
            </button>
            <button 
              onClick={() => setRightPanelTab("engine")}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${rightPanelTab === "engine" ? "text-white bg-[#121212] border-t-2 border-t-blue-500" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"}`}
            >
                <Brain size={16} /> Engine Analysis
            </button>
        </div>

        {/* Panel Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {rightPanelTab === "config" && (
            <div className="flex flex-col gap-8">
              {/* Opponent Selection (matches previous styling) */}
          <div className="grid grid-cols-2 gap-6 relative">
             {/* Decorative Swap Arrow */}
             <div className="absolute left-1/2 top-6 -translate-x-1/2 w-8 h-8 rounded-full bg-[#202020] border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-[#2a2a2a] cursor-pointer transition-colors z-10 shadow-lg" onClick={() => {
                 setWhiteType(blackType);
                 setBlackType(whiteType);
                 setWhitePlayer(blackPlayer);
                 setBlackPlayer(whitePlayer);
             }}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
             </div>

            {/* White Player */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-neutral-300 text-center">White</h3>
              <div className="flex rounded-lg overflow-hidden border border-white/10 bg-[#1a1a1a] p-1">
                <button
                  onClick={() => setWhiteType("human")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${whiteType === "human" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                >
                  <User size={16} /> Human
                </button>
                <button
                  onClick={() => setWhiteType("engine")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${whiteType === "engine" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                >
                  <Cpu size={16} /> Engine
                </button>
              </div>
              <input
                type="text"
                value={whitePlayer}
                onChange={(e) => setWhitePlayer(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder={whiteType === "human" ? "Player Name" : "Engine Name"}
              />
            </div>

            {/* Black Player */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-neutral-300 text-center">Black</h3>
              <div className="flex rounded-lg overflow-hidden border border-white/10 bg-[#1a1a1a] p-1">
                <button
                  onClick={() => setBlackType("human")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${blackType === "human" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                >
                  <User size={16} /> Human
                </button>
                <button
                  onClick={() => setBlackType("engine")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${blackType === "engine" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
                >
                  <Cpu size={16} /> Engine
                </button>
              </div>
              <input
                type="text"
                value={blackPlayer}
                onChange={(e) => setBlackPlayer(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder={blackType === "human" ? "Player Name" : "Engine Name"}
              />
            </div>
          </div>

          {/* Time Controls */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                    <Clock size={16} /> Time Settings
                </h3>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-neutral-400 cursor-pointer flex items-center gap-2">
                        <input type="checkbox" checked={sameTimeControl} onChange={(e) => setSameTimeControl(e.target.checked)} className="accent-blue-500 rounded" />
                        Same for both
                    </label>
                </div>
            </div>

            <div className="flex rounded-lg overflow-hidden border border-white/10 bg-[#1a1a1a] p-1">
              <button
                onClick={() => setTimeControl("time")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${timeControl === "time" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                Time / Auto
              </button>
              <button
                onClick={() => setTimeControl("unlimited")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${timeControl === "unlimited" ? "bg-[#2a2a2a] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                Unlimited
              </button>
            </div>

            {timeControl === "time" && (
              <div className="grid grid-cols-2 gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-white/5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500 font-medium">Minutes per side</label>
                  <div className="flex items-center bg-[#252525] rounded-lg border border-white/5 overflow-hidden">
                      <input
                        type="number"
                        min="1"
                        value={timeMinutes}
                        onChange={(e) => setTimeMinutes(parseInt(e.target.value) || 1)}
                        className="w-full bg-transparent text-white px-3 py-2 text-sm focus:outline-none"
                      />
                      <span className="px-3 text-neutral-500 text-xs font-mono bg-black/20 border-l border-white/5 py-2.5">m</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500 font-medium">Increment in seconds</label>
                   <div className="flex items-center bg-[#252525] rounded-lg border border-white/5 overflow-hidden">
                      <input
                        type="number"
                        min="0"
                        value={incrementSeconds}
                        onChange={(e) => setIncrementSeconds(parseInt(e.target.value) || 0)}
                        className="w-full bg-transparent text-white px-3 py-2 text-sm focus:outline-none"
                      />
                      <span className="px-3 text-neutral-500 text-xs font-mono bg-black/20 border-l border-white/5 py-2.5">s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

              <button
                onClick={() => onStartGame({ whiteType, blackType, whitePlayer, blackPlayer, timeControl, timeMinutes, incrementSeconds })}
                className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              >
                Start Game
              </button>
            </div>
          )}

          {rightPanelTab === "engine" && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-500">
               <Brain size={48} className="mb-4 text-neutral-700" />
               <p className="text-sm">Engine analysis configuration will appear here.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
};
