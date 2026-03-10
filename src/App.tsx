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

function App() {
  const [history, setHistory] = useState<HistoryNode[]>([{ fen: "start", move: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isEngineOn, setIsEngineOn] = useState(false);
  const [engineEval, setEngineEval] = useState<string>("0.00");

  const [profiles, setProfiles] = useState<UserProfile[]>([]);

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
            <aside className="flex-1 h-full bg-[#1e1e1e] border-l border-white/5 flex flex-col justify-center items-center p-8 shadow-[-8px_0_24px_rgba(0,0,0,0.2)] z-10 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="w-full max-w-md flex flex-col gap-6 relative z-10">
                <h2 className="text-3xl font-bold text-white text-center mb-2 tracking-tight">Play Chess</h2>

                <div className="grid grid-cols-2 gap-4">
                  <button className="flex flex-col items-center justify-center gap-4 bg-[#252525] hover:bg-[#2a2a2a] border border-white/5 p-6 rounded-2xl transition-all hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] group">
                    <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bot size={32} />
                    </div>
                    <span className="text-white font-semibold">Computer</span>
                  </button>
                  <button className="flex flex-col items-center justify-center gap-4 bg-[#252525] hover:bg-[#2a2a2a] border border-white/5 p-6 rounded-2xl transition-all hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] group">
                    <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users size={32} />
                    </div>
                    <span className="text-white font-semibold">Play a Friend</span>
                  </button>
                </div>

                <div className="bg-[#252525] border border-white/5 rounded-2xl p-6 mt-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="flex items-center justify-between mb-5 relative z-10">
                    <h3 className="text-white font-semibold">Quick Pairing</h3>
                    <button className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">Custom Time</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm relative z-10">
                    <button className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 font-medium transition-colors hover:text-white">1 min</button>
                    <button className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 font-medium transition-colors hover:text-white">3 min</button>
                    <button className="py-3 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl font-semibold transition-colors shadow-[0_0_15px_rgba(59,130,246,0.1)]">5 min</button>
                    <button className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 font-medium transition-colors hover:text-white">10 min</button>
                    <button className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 font-medium transition-colors hover:text-white">15 min</button>
                    <button className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 font-medium transition-colors hover:text-white">30 min</button>
                  </div>
                  <button className="w-full mt-6 py-3.5 bg-[#1e61d4] hover:bg-[#2568e6] text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98] relative z-10">
                    Play Online
                  </button>
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
          <div className="flex flex-col items-center justify-center text-center max-w-md z-10">
            <div className="w-20 h-20 bg-neutral-800 text-neutral-400 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-lg">
              <Settings size={40} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Settings</h1>
            <p className="text-neutral-500 text-sm">
              Engine depth configuration, custom themes, and sound effects coming soon.
            </p>
          </div>
        </main>
      )}

    </div>
  );
}

export default App;