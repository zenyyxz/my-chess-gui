import { useMemo, useState, useEffect } from "react";
import { Play, Book, Settings, RotateCcw, ChevronLeft, ChevronRight, FastForward, Cpu, Bot, Users, Database } from "lucide-react";
import { ChessBoard } from "./components/ChessBoard";
import { EvalBar } from "./components/EvalBar";
import { EnginesTab } from "./components/EnginesTab";
import { UsersTab } from "./components/UsersTab";
import { DatabaseTab } from "./components/DatabaseTab";
import { UserProfile } from "./types";
import { Chess } from "chess.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "chessground/assets/chessground.brown.css"; // Board style

interface HistoryNode {
  fen: string;
  move: string | null;
}

export const BOARD_THEMES = [
  { id: "dark", name: "Dark", light: "#525252", dark: "#2f2f2f" },
  { id: "classic_wood", name: "Classic Wood", light: "#f0d9b5", dark: "#b58863" },
  { id: "glass", name: "Glass", light: "#e0e4e7", dark: "#4f6476" },
  { id: "brown", name: "Brown", light: "#f1d9b5", dark: "#b58863" },
  { id: "blue", name: "Blue", light: "#dbeafe", dark: "#1e3a8a" },
  { id: "newspaper", name: "Newspaper", light: "#E0E0E0", dark: "#9B9B9B" },
  { id: "walnut", name: "Walnut", light: "#ceae84", dark: "#7b5945" },
  { id: "sky", name: "Sky", light: "#edf2f6", dark: "#b2cde0" },
  { id: "stone", name: "Stone", light: "#d6ddec", dark: "#b4c4cb" },
  { id: "granite", name: "Granite", light: "#8d8d8e", dark: "#4e4e50" },
  { id: "burnt_wood", name: "Burnt Wood", light: "#f5c7a1", dark: "#cf7640" },
  { id: "classic_green", name: "Classic Green", light: "#eeeed2", dark: "#769656" },
  { id: "olive", name: "Olive", light: "#d1d6c5", dark: "#6f7565" },
  { id: "purple", name: "Purple", light: "#f5f5f5", dark: "#897bb1" },
  { id: "light_gray", name: "Light Gray", light: "#F0F0F0", dark: "#D1D1D1" },
  { id: "silver", name: "Silver", light: "#e1e1e1", dark: "#898989" },
  { id: "tournament", name: "Tournament", light: "#f2f2f2", dark: "#2c6943" },
  { id: "cherry", name: "Cherry", light: "#D4A559", dark: "#713426" },
  { id: "red_wood", name: "Red Wood", light: "#e7a870", dark: "#a03c28" },
  { id: "navy", name: "Navy", light: "#F0EAD6", dark: "#416792" },
  { id: "pink", name: "Pink", light: "#ffeAEB", dark: "#F6C1C9" },
  { id: "bases", name: "Bases", light: "#3E3E3E", dark: "#7B3939" },
  { id: "rust", name: "Rust", light: "#9E9E9E", dark: "#C17937" },
  { id: "sand", name: "Sand", light: "#e6c99f", dark: "#c79664" },
  { id: "mustard", name: "Mustard", light: "#FFCE87", dark: "#D58810" },
  { id: "parchment", name: "Parchment", light: "#EBDDB1", dark: "#BCA371" },
  { id: "red_cream", name: "Red", light: "#F1D4B8", dark: "#B84A42" },
  { id: "neon_blue", name: "Neon Blue", light: "#EBF0FF", dark: "#438CFF" },
  { id: "coral", name: "Coral", light: "#fce5cd", dark: "#cc4125" },
  { id: "mint", name: "Mint", light: "#d9ead3", dark: "#6aa84f" }
];

function App() {
  const [history, setHistory] = useState<HistoryNode[]>([{ fen: "start", move: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isEngineOn, setIsEngineOn] = useState(false);
  const [engineEval, setEngineEval] = useState<string>("0.00");

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [theme, setTheme] = useState<string>("classic_green");

  const currentFen = history[historyIndex].fen;

  // Use a temporary game instance to derive some board state statuses
  const gameStatus = useMemo(() => {
    const g = new Chess();
    if (currentFen !== "start") {
      try {
        g.load(currentFen);
      } catch (e) {
        // ignore invalid fen
      }
    }
    return {
      isCheckmate: g.isCheckmate(),
      isDraw: g.isDraw(),
      isStalemate: g.isStalemate(),
      isCheck: g.inCheck(),
      turn: g.turn(),
    };
  }, [currentFen]);

  // Engine Event Listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const asyncSetup = async () => {
      unlisten = await listen<string>("engine-output", (event) => {
        const line = event.payload;

        // Use state functional updates to avoid stale closures
        setHistory((prevHistory) => {
          // Find the active FEN to evaluate
          const fen = prevHistory[prevHistory.length - 1].fen;

          if (line.startsWith("info depth") && line.includes("score cp")) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
              let evalScore = parseInt(match[1], 10) / 100;
              const wToMove = fen.includes(" w ");
              if (!wToMove) evalScore = -evalScore;
              setEngineEval(evalScore > 0 ? `+${evalScore.toFixed(2)}` : evalScore.toFixed(2));
            }
          } else if (line.startsWith("info depth") && line.includes("score mate")) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) {
              let mateIn = parseInt(match[1], 10);
              const wToMove = fen.includes(" w ");
              if (!wToMove) mateIn = -mateIn;
              setEngineEval(mateIn > 0 ? `+M${mateIn}` : `-M${Math.abs(mateIn)}`);
            }
          } else if (line.startsWith("bestmove")) {
            const match = line.split(" ");
            if (match.length >= 2 && match[1] !== "(none)") {
              const bestMoveStr = match[1];

              const isBlackTurn = fen.includes(" b ");
              if (isBlackTurn) {
                const from = bestMoveStr.substring(0, 2);
                const to = bestMoveStr.substring(2, 4);
                const promotion = bestMoveStr.length > 4 ? bestMoveStr.substring(4, 5) : undefined;

                const nextGame = new Chess();
                if (fen !== "start") nextGame.load(fen);

                const moved = nextGame.move({ from, to, promotion });
                if (moved) {
                  // Only push the move if the backend is synced
                  setHistoryIndex((idx) => {
                    // We only want to auto-play if the user is viewing the latest board state
                    if (idx === prevHistory.length - 1) {
                      return idx + 1;
                    }
                    return idx;
                  });
                  return [...prevHistory, { fen: nextGame.fen(), move: moved.san }];
                }
              }
            }
          }
          return prevHistory;
        });

      });
    };
    asyncSetup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []); // Empty deps


  const toggleEngine = async () => {
    if (isEngineOn) {
      await invoke("stop_engine");
      setIsEngineOn(false);
      setEngineEval("0.00");
    } else {
      try {
        await invoke("start_engine", { path: "stockfish" });
        await invoke("send_engine_command", { command: "uci" });
        setIsEngineOn(true);
      } catch (e: any) {
        console.error("Failed to start engine:", e);
        alert(`Could not start Stockfish: ${e}. Is it installed in your PATH?`);
      }
    }
  };

  // Re-evaluate when pos changes
  useEffect(() => {
    if (isEngineOn) {
      const fenArg = currentFen === "start" ? "startpos" : `fen ${currentFen}`;
      invoke("send_engine_command", { command: `position ${fenArg}` });
      // If black's turn (engine), go depth 15 as a move, otherwise go depth 15 as eval
      invoke("send_engine_command", { command: "go depth 15" });
    }
  }, [currentFen, isEngineOn]);

  const handleMove = (moveInfo: any, newFen: string) => {
    const nextGame = new Chess();
    if (currentFen !== "start") nextGame.load(currentFen);

    // Determine the SAN (Standard Algebraic Notation) representation the player just played
    const moved = nextGame.move(moveInfo);

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ fen: newFen, move: moved?.san || null });
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) setHistoryIndex((i) => i - 1);
  };

  const redo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex((i) => i + 1);
  };

  const reset = () => {
    setHistory([{ fen: "start", move: null }]);
    setHistoryIndex(0);
  };

  const goToStart = () => setHistoryIndex(0);
  const goToEnd = () => setHistoryIndex(history.length - 1);

  // Group history into move pairs for rendering (e.g. 1. e4 e5)
  const renderMovePairs = () => {
    const pairs = [];
    // skip the "start" node at index 0
    for (let i = 1; i < history.length; i += 2) {
      pairs.push({
        num: Math.ceil(i / 2),
        white: { move: history[i].move, index: i },
        black: i + 1 < history.length ? { move: history[i + 1].move, index: i + 1 } : null,
      });
    }
    return pairs;
  };

  const [activeTab, setActiveTab] = useState<"play" | "library" | "database" | "engines" | "users" | "settings">("play");
  const [settingsTab, setSettingsTab] = useState<"board" | "analysis" | "theme" | "home" | "privacy">("board");

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (light: string, dark: string) => {
      root.style.setProperty("--color-board-light", light);
      root.style.setProperty("--color-board-dark", dark);
    };

    const selectedTheme = BOARD_THEMES.find(t => t.id === theme) || BOARD_THEMES[11]; // classic_green
    applyTheme(selectedTheme.light, selectedTheme.dark);
  }, [theme]);

  return (
    <div className="flex w-full h-full bg-[#161616] text-[#f2f2f2]">
      {/* Sidebar Navigation */}
      <aside className="w-16 h-full bg-[#0f0f0f] flex flex-col items-center py-6 border-r border-white/5 shadow-xl z-20 flex-shrink-0">
        <div className="flex flex-col gap-6 w-full items-center">
          <button
            onClick={() => setActiveTab("play")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "play" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Play size={22} />
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "library" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Book size={22} />
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "database" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Database size={22} />
          </button>
          <button
            onClick={() => setActiveTab("engines")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "engines" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Bot size={22} />
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "users" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Users size={22} />
          </button>
        </div>
        <div className="mt-auto">
          <button
            onClick={() => setActiveTab("settings")}
            className={`p-3 rounded-xl transition-colors ${activeTab === "settings" ? "bg-blue-500/10 text-blue-500" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <Settings size={22} />
          </button>
        </div>
      </aside>

      {/* Conditional Rendering based on Active Tab */}
      {activeTab === "play" && (
        <>
          {/* Main Board Area */}
          <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex flex-col gap-4 relative z-10 w-full lg:w-auto h-full justify-center max-h-[85vh]">
              {/* Opponent Profile Placeholder */}
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-white/5 flex items-center justify-center shadow-lg">
                  <span className="text-neutral-400 font-medium tracking-tighter">OP</span>
                </div>
                <div>
                  <div className="font-semibold text-sm drop-shadow-sm">Stockfish 18</div>
                  <div className="text-xs text-neutral-500 font-medium">3200 (Engine)</div>
                </div>
              </div>

              {/* Board Container */}
              <div className="flex flex-row items-stretch gap-4 mx-auto flex-1 h-[75vh] min-h-0">
                <EvalBar evaluation={engineEval} />
                <div className="rounded-md overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 aspect-square h-full">
                  <ChessBoard fen={currentFen} onMove={handleMove} orientation="white" />
                </div>
              </div>

              {/* Player Profile Placeholder */}
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  <span className="font-medium tracking-tighter">ME</span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm drop-shadow-sm">Player 1</div>
                  <div className="text-xs text-neutral-400 font-medium flex gap-2">
                    1500
                    {gameStatus.isCheckmate && <span className="text-red-400 ml-auto badge font-bold">Checkmate</span>}
                    {gameStatus.isDraw && <span className="text-yellow-400 ml-auto badge font-bold">Draw</span>}
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Right Details Panel */}
          {history.length > 1 ? (
            <aside className="w-[340px] h-full bg-[#1e1e1e] border-l border-white/5 flex flex-col flex-shrink-0 shadow-[-8px_0_24px_rgba(0,0,0,0.2)] z-10">
              {/* Engine Eval / Tabs */}
              <div className="h-14 border-b border-white/5 flex items-center justify-between px-4">
                <div className="flex gap-6 text-sm font-medium">
                  <button className="text-white relative after:absolute after:bottom-[-16px] after:left-0 after:w-full after:h-[2px] after:bg-blue-500">Game</button>
                  <button className="text-neutral-500 hover:text-neutral-300 transition-colors">Engine</button>
                </div>

                {/* Eval Display & Toggle */}
                <div className="flex items-center gap-3">
                  {isEngineOn && (
                    <span className="text-sm font-mono tracking-tighter font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{engineEval}</span>
                  )}
                  <button
                    onClick={toggleEngine}
                    className={`p-1.5 rounded-lg transition-colors ${isEngineOn ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-neutral-400 hover:text-white"}`}
                  >
                    <Cpu size={16} />
                  </button>
                </div>
              </div>

              {/* Move History */}
              <div className="flex-1 overflow-y-auto p-4 content-start">
                <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2 gap-y-1 text-sm">
                  {renderMovePairs().map((pair) => (
                    <div key={pair.num} className="contents relative">
                      <div className="text-neutral-500 py-1 font-mono text-[11px] flex items-center justify-center select-none">{pair.num}</div>

                      <div
                        onClick={() => setHistoryIndex(pair.white.index)}
                        className={`cursor-pointer rounded px-2 py-1 transition-colors select-none font-medium ${historyIndex === pair.white.index ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' : 'bg-white/5 hover:bg-white/10 text-neutral-300'}`}
                      >
                        {pair.white.move}
                      </div>

                      {pair.black ? (
                        <div
                          onClick={() => setHistoryIndex(pair.black!.index)}
                          className={`cursor-pointer rounded px-2 py-1 transition-colors select-none font-medium ${historyIndex === pair.black.index ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' : 'hover:bg-white/10 text-neutral-300'}`}
                        >
                          {pair.black.move}
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Game Controls */}
              <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                <div className="flex items-center justify-between mb-4 bg-[#252525] rounded-xl p-1 shadow-inner">
                  <button
                    onClick={goToStart}
                    disabled={historyIndex === 0}
                    className="p-2 w-full flex justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={undo}
                    disabled={historyIndex === 0}
                    className="p-2 w-full flex justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyIndex === history.length - 1}
                    className="p-2 w-full flex justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <button
                    onClick={goToEnd}
                    disabled={historyIndex === history.length - 1}
                    className="p-2 w-full flex justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
                  >
                    <FastForward size={18} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={reset} className="w-1/3 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 text-sm font-medium hover:bg-neutral-700 transition-colors border border-white/5">
                    Reset
                  </button>
                  <button className="w-2/3 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors border border-red-500/20">
                    Resign
                  </button>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="flex-1 h-full bg-[#161616] flex flex-col justify-center items-center p-8 z-10 relative overflow-y-auto">
              <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 relative z-10">
                {/* Play Chess */}
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-6 hover:bg-[#252525] transition-colors flex flex-col items-center text-center">
                  <div className="w-12 h-12 mb-4 text-neutral-300">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-current">
                      <path d="M16 22H8C7.44772 22 7 21.5523 7 21C7 20.4477 7.44772 20 8 20H16C16.5523 20 17 20.4477 17 21C17 21.5523 16.5523 22 16 22ZM15.5 17C15.5 18.1046 14.6046 19 13.5 19H10.5C9.39543 19 8.5 18.1046 8.5 17L9 11C8.44772 11 8 10.5523 8 10C8 9.44772 8.44772 9 9 9C9.55228 9 10 9.44772 10 10H14C14 9.44772 14.4477 9 15 9C15.5523 9 16 9.44772 16 10C16 10.5523 15.5523 11 15 11L15.5 17ZM12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8ZM12 5C12.5523 5 13 5.44772 13 6C13 6.55228 12.5523 7 12 7C11.4477 7 11 6.55228 11 6C11 5.44772 11.4477 5 12 5Z" fill="currentColor" />
                    </svg>
                  </div>
                  <h3 className="text-[#f2f2f2] font-semibold mb-1">Play Chess</h3>
                  <p className="text-neutral-500 text-xs flex-1 mb-6">Play against an engine or a friend</p>
                  <button className="w-full py-2 bg-[#2a3645] hover:bg-[#344050] text-[#7392b5] font-semibold rounded-lg transition-colors text-sm">Play</button>
                </div>

                {/* Analysis Board */}
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-6 hover:bg-[#252525] transition-colors flex flex-col items-center text-center">
                  <div className="w-12 h-12 mb-4 text-neutral-300">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-current">
                      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4 12H20M12 4V20M8 4V20M16 4V20M4 8H20M4 16H20" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <h3 className="text-[#f2f2f2] font-semibold mb-1">Analysis Board</h3>
                  <p className="text-neutral-500 text-xs flex-1 mb-6">Analyze a game or position</p>
                  <button className="w-full py-2 bg-[#2a3645] hover:bg-[#344050] text-[#7392b5] font-semibold rounded-lg transition-colors text-sm">Open</button>
                </div>

                {/* New Repertoire */}
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-6 hover:bg-[#252525] transition-colors flex flex-col items-center text-center">
                  <div className="w-12 h-12 mb-4 text-neutral-300">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-current">
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                      <path d="M12 12L18 6L16 5M18 6L19 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-[#f2f2f2] font-semibold mb-1">New Repertoire</h3>
                  <p className="text-neutral-500 text-xs flex-1 mb-6">Build and practice your opening repertoire</p>
                  <button className="w-full py-2 bg-[#2a3645] hover:bg-[#344050] text-[#7392b5] font-semibold rounded-lg transition-colors text-sm">Create</button>
                </div>

                {/* Import Game */}
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-6 hover:bg-[#252525] transition-colors flex flex-col items-center text-center">
                  <div className="w-12 h-12 mb-4 text-neutral-300">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-current">
                      <path d="M13 3H8C6.89543 3 6 3.89543 6 5V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V9L13 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13 3V9H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 14H9M12 11V17M12 17L9 14M12 17L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-[#f2f2f2] font-semibold mb-1">Import Game</h3>
                  <p className="text-neutral-500 text-xs flex-1 mb-6">Import a game from a PGN</p>
                  <button className="w-full py-2 bg-[#2a3645] hover:bg-[#344050] text-[#7392b5] font-semibold rounded-lg transition-colors text-sm">Import</button>
                </div>

                {/* Puzzles */}
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-6 hover:bg-[#252525] transition-colors flex flex-col items-center text-center">
                  <div className="w-12 h-12 mb-4 text-neutral-300">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-current">
                      <path d="M10.9997 3C10.9997 4.10457 11.8951 5 12.9997 5C14.1043 5 14.9997 4.10457 14.9997 3C15.6547 3 16.2307 3 16.7324 3C17.8524 3 18.4124 3 18.8402 3.21799C19.2165 3.40973 19.5899 3.78318 19.7817 4.15947C19.9997 4.58728 19.9997 5.14728 19.9997 6.26728V6.26728C19.9997 6.76899 19.9997 7.34499 19.9997 7.99999C20.8407 8.01918 21.6023 8.35626 22.0805 8.9E-05C21.7824 9.17066 21 10.0232 21 11.0822C21 12.1411 21.7824 12.9937 22.0805 13.1643C22.046 13.1835 22.0233 13.1953 22.0007 13.2088C21.5728 13.4682 21.0128 13.4144 19.8928 13.3068C19.4997 13.2689 18.9997 13.2208 18.9997 13.2208V14.2209C18.9997 15.3409 18.9997 15.9009 18.8837 16.3243C18.4716 17.8288 18.3288 17.9716 16.8242 18.3837C16.4009 18.4996 15.8409 18.4996 14.7208 18.4996H12.9997C11.8951 18.4996 10.9997 19.3951 10.9997 20.4996C10.9997 21.6042 10.1043 22.4996 8.99969 22.4996C7.89512 22.4996 6.99969 21.6042 6.99969 20.4996C6.99969 19.3951 6.10426 18.4996 4.99969 18.4996H4.22084C3.10084 18.4996 2.54084 18.4996 2.11749 18.3837C0.612866 17.9716 0.470067 17.8288 0.0579737 16.3243C-0.0579736 15.9009 -0.0579736 15.3409 -0.0579736 14.2209V6.26728C-0.0579736 5.14728 -0.0579736 4.58728 0.159986 4.15947C0.351726 3.78318 0.725176 3.40973 1.10146 3.21799C1.52927 3 2.08927 3 3.20927 3H4.99969C4.99969 4.10457 5.89512 5 6.99969 5C8.10427 5 8.99969 4.10457 8.99969 3H10.9997Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="text-[#f2f2f2] font-semibold mb-1">Puzzles</h3>
                  <p className="text-neutral-500 text-xs flex-1 mb-6">Train your chess skills</p>
                  <button className="w-full py-2 bg-[#2a3645] hover:bg-[#344050] text-[#7392b5] font-semibold rounded-lg transition-colors text-sm">Train</button>
                </div>

              </div>
            </aside>
          )}
        </>
      )}

      {activeTab === "library" && (
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="flex flex-col items-center justify-center text-center max-w-md z-10">
            <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
              <Book size={40} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Game Library</h1>
            <p className="text-neutral-400 text-sm mb-8">
              Explore your past games, analyze GM masterclasses, or import PGNs to test the engine's perspective!
            </p>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20">
              Import PGN
            </button>
          </div>
        </main>
      )}

      {activeTab === "database" && (
        <DatabaseTab profiles={profiles} />
      )}

      {activeTab === "engines" && (
        <EnginesTab />
      )}

      {activeTab === "users" && (
        <UsersTab
          profiles={profiles}
          onAddProfile={(profile) => setProfiles(prev => [...prev, { ...profile, id: Date.now().toString() }])}
        />
      )}

      {activeTab === "settings" && (
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="w-full max-w-5xl flex flex-col gap-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Settings</h1>
                <p className="text-neutral-500 text-sm">
                  Tune how the board looks, how analysis behaves, and how the app feels.
                </p>
              </div>
              <div className="w-14 h-14 bg-neutral-900 text-neutral-400 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
                <Settings size={28} />
              </div>
            </div>

            {/* Settings tabs menu */}
            <div className="flex flex-wrap gap-2 rounded-xl bg-[#141414] border border-white/5 p-1">
              {[
                { id: "board", label: "Board" },
                { id: "analysis", label: "Analysis" },
                { id: "theme", label: "Theme" },
                { id: "home", label: "Home" },
                { id: "privacy", label: "Privacy" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id as typeof settingsTab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settingsTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Settings content */}
            <section className="rounded-2xl bg-[#111111] border border-white/5 p-6 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
              {settingsTab === "board" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">Board</h2>
                  <p className="text-sm text-neutral-500">
                    Configure board orientation, coordinates, move highlights, and animation speed. Actual controls
                    can plug in here as the next step.
                  </p>
                </div>
              )}

              {settingsTab === "analysis" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">Analysis</h2>
                  <p className="text-sm text-neutral-500">
                    Future options for engine depth, multi-PV, and automatic analysis when a game ends.
                  </p>
                </div>
              )}

              {settingsTab === "theme" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Theme</h2>
                    <p className="text-sm text-neutral-500">
                      Pick a board color preset. Changes apply instantly to the main board.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <h3 className="text-md font-semibold text-white border-b border-white/5 pb-2">Boards</h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-3">
                      {BOARD_THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          className={`group relative flex items-center justify-center rounded-lg overflow-hidden transition-all aspect-square border-2 shadow-md ${
                            theme === t.id
                              ? "border-[#81b64c] shadow-[0_0_12px_rgba(129,182,76,0.5)]"
                              : "border-transparent border-white/5 hover:border-white/20"
                          }`}
                          title={t.name}
                        >
                          <div className="w-full h-full grid grid-cols-2 grid-rows-2 shrink-0">
                            {/* 2x2 grid representing a board */}
                            <div style={{ backgroundColor: t.light }} />
                            <div style={{ backgroundColor: t.dark }} />
                            <div style={{ backgroundColor: t.dark }} />
                            <div style={{ backgroundColor: t.light }} />
                          </div>

                          {/* Selected overlay and checkmark */}
                          {theme === t.id && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                              <div className="w-6 h-6 bg-[#81b64c] rounded-full flex items-center justify-center text-white scale-110 shadow-lg border-2 border-white/10">
                                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 ml-[1px]" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "home" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">Home</h2>
                  <p className="text-sm text-neutral-500">
                    Control which sections appear on the home screen and what your default action is when the app
                    launches.
                  </p>
                </div>
              )}

              {settingsTab === "privacy" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">Privacy</h2>
                  <p className="text-sm text-neutral-500">
                    Manage telemetry, local data storage, and what is synced with online services.
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      )}

    </div>
  );
}

export default App;