import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessground } from "chessground";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import { Api } from "chessground/api";

type Key = string; // Using string to simplify since chessground exports it deeply

interface ChessBoardProps {
    fen?: string;
    onMove?: (move: { from: string; to: string; promotion?: string }, fen: string, pgn: string) => void;
    orientation?: "white" | "black";
}

export function ChessBoard({ fen = "start", onMove, orientation = "white" }: ChessBoardProps) {
    const boardRef = useRef<HTMLDivElement>(null);
    const [cg, setCg] = useState<Api | null>(null);
    const gameRef = useRef(new Chess());

    useEffect(() => {
        if (fen && fen !== "start") {
            gameRef.current.load(fen);
        } else if (fen === "start") {
            gameRef.current.reset();
        }

        if (cg) {
            cg.set({ fen: gameRef.current.fen() });
        }
    }, [fen, cg]);

    const onMoveRef = useRef(onMove);
    useEffect(() => {
        onMoveRef.current = onMove;
    }, [onMove]);

    useEffect(() => {
        if (!boardRef.current) return;

        const game = gameRef.current;

        const config = {
            orientation,
            turnColor: game.turn() === "w" ? "white" : "black",
            highlight: { lastMove: true, check: true },
            check: game.inCheck(),
            movable: {
                color: orientation,
                free: false,
                dests: toDests(game)
            },
            events: {
                move: (orig: Key, dest: Key) => {
                    // Attempt the move in chess.js
                    try {
                        const move = game.move({
                            from: orig,
                            to: dest,
                            promotion: "q", // Always promote to queen for now
                        });

                        if (move) {
                            if (onMoveRef.current) {
                                onMoveRef.current({ from: orig, to: dest, promotion: "q" }, game.fen(), game.pgn());
                            }
                        }
                    } catch (e) {
                        // Illegal move, revert the board state
                        if (cgApi) {
                            cgApi.set({ fen: game.fen() });
                        }
                    }
                }
            }
        };

        // @ts-expect-error Chessground types
        const cgApi = Chessground(boardRef.current, config);
        setCg(cgApi);

        return () => {
            cgApi.destroy();
        };
    }, [orientation]); // Remove onMove from dependency array
    // Update movable rules whenever it's our turn
    useEffect(() => {
        if (cg) {
            const game = gameRef.current;

            // Update movable rules whenever it's our turn
            cg.set({
                turnColor: game.turn() === "w" ? "white" : "black",
                check: game.inCheck(),
                movable: {
                    color: orientation,
                    dests: toDests(game)
                }
            });
        }
    }, [fen, cg, orientation]);

    return <div ref={boardRef} className="w-full h-full" />;
}

// Helper to calculate available destinations for each piece using chess.js
function toDests(chess: Chess) {
    const dests = new Map();
    chess.board().forEach((row) => {
        row.forEach((piece) => {
            if (piece && piece.color === chess.turn()) {
                const square = piece.square;
                const moves = chess.moves({ square, verbose: true });
                if (moves.length) {
                    dests.set(
                        square,
                        moves.map((m) => m.to)
                    );
                }
            }
        });
    });
    return dests;
}
