import { useMemo, useState, useEffect } from "react";
import { Play, Book, Settings, RotateCcw, ChevronLeft, ChevronRight, FastForward, Cpu } from "lucide-react";
import { ChessBoard } from "./components/ChessBoard";
import { Chess } from "chess.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface HistoryNode {
  fen: string;
  move: string | null;
}

function App() {
  const [history, setHistory] = useState<HistoryNode[]>([{ fen: "start", move: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isEngineOn, setIsEngineOn] = useState(false);
  const [engineEval, setEngineEval] = useState<string>("0.00");

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
        if (line.startsWith("info depth") && line.includes("score cp")) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            let evalScore = parseInt(match[1], 10) / 100;
            // Stockfish eval is from engine's POV. If it's black's turn, negate it for absolute white POV
            // Wait, standard stockfish "score cp" is from the side to move's POV.
            const wToMove = currentFen.includes(" w ");
            if (!wToMove) evalScore = -evalScore;

            setEngineEval(evalScore > 0 ? `+${evalScore.toFixed(2)}` : evalScore.toFixed(2));
          }
        } else if (line.startsWith("info depth") && line.includes("score mate")) {
          const match = line.match(/score mate (-?\d+)/);
          if (match) {
            let mateIn = parseInt(match[1], 10);
            const wToMove = currentFen.includes(" w ");
            if (!wToMove) mateIn = -mateIn;
            setEngineEval(mateIn > 0 ? `+M${mateIn}` : `-M${Math.abs(mateIn)}`);
          }
        }
      });
    };
    asyncSetup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [currentFen]);

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
      invoke("send_engine_command", { command: "go depth 15" });
    }
  }, [currentFen, isEngineOn]);

  const handleMove = (moveInfo: any, newFen: string) => {
    const nextGame = new Chess();
    if (currentFen !== "start") nextGame.load(currentFen);

    // Determine the SAN (Standard Algebraic Notation) representation the player just played
    const moved = nextGame.move(moveInfo);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ fen: newFen, move: moved?.san || null });

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
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

  return (
    <div className="flex w-full h-full bg-[#161616] text-[#f2f2f2]">
      {/* Sidebar Navigation */}
      <aside className="w-16 h-full bg-[#0f0f0f] flex flex-col items-center py-6 border-r border-white/5 shadow-xl z-10 flex-shrink-0">
        <div className="flex flex-col gap-6 w-full items-center">
          <button className="p-3 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors">
            <Play size={22} />
          </button>
          <button className="p-3 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors">
            <Book size={22} />
          </button>
        </div>
        <div className="mt-auto">
          <button className="p-3 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={22} />
          </button>
        </div>
      </aside>

      {/* Main Board Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col gap-4 relative z-10 w-full max-w-[70vmin] lg:max-w-none lg:w-auto">
          {/* Opponent Profile Placeholder */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-white/5 flex items-center justify-center shadow-lg">
              <span className="text-neutral-400 font-medium tracking-tighter">OP</span>
            </div>
            <div>
              <div className="font-semibold text-sm drop-shadow-sm">Stockfish 16</div>
              <div className="text-xs text-neutral-500 font-medium">3200 (Engine)</div>
            </div>
          </div>

          {/* Board Container */}
          <div className="rounded-md overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 mx-auto" style={{ width: "min(70vmin, 600px)", height: "min(70vmin, 600px)" }}>
            <ChessBoard fen={currentFen} onMove={handleMove} orientation="white" />
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
                {gameStatus.isCheck && !gameStatus.isCheckmate && <span className="text-orange-400 ml-auto badge font-bold">Check</span>}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Details Panel */}
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
    </div>
  );
}

export default App;