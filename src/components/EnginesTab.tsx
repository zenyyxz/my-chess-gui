import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChevronLeft, Download, Cpu, CheckCircle, Loader2, Plus, HardDrive, X } from "lucide-react";

interface EngineInfo {
    id: string;
    name: string;
    description: string;
    url: string;
    elo: number;
    size: string;
    isDownloaded: boolean;
    isDownloading: boolean;
}

interface EnginesTabProps {
    onBack?: () => void;
}

export const EnginesTab = ({ onBack }: EnginesTabProps) => {
    // Top UCI engines with direct raw executable links (using example static links/builds)
    const [engines, setEngines] = useState<EngineInfo[]>([
        {
            id: "stockfish_16_1",
            name: "Stockfish 16.1",
            description: "The strongest open-source chess engine in the world. Dominates almost all rating lists.",
            url: "https://github.com/official-stockfish/Stockfish/releases/download/sf_16.1/stockfish-windows-x86-64-avx2.zip",
            elo: 3600,
            size: "~40 MB",
            isDownloaded: false,
            isDownloading: false,
        }
    ]);

    const [progressText, setProgressText] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        const checkDownloaded = async () => {
             const updatedEngines = await Promise.all(
                engines.map(async (engine) => {
                    try {
                        const isDownloaded = await invoke<boolean>("check_engine_exists", { name: engine.id });
                        return { ...engine, isDownloaded };
                    } catch (e) {
                         return engine;
                    }
                })
            );
            setEngines(updatedEngines);
        };
        checkDownloaded();

        let unlisten: (() => void) | undefined;
        const setupListener = async () => {
            unlisten = await listen<string>("download-progress", (event) => {
                setProgressText(event.payload);
            });
        };
        setupListener();

        return () => {
            if (unlisten) unlisten();
        }
    }, []);

    const handleDownload = async (engineId: string, url: string) => {
        setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloading: true } : e));
        setProgressText(`Starting download for ${engineId}...`);

        try {
            // Invokes the rust function that saves directly to .exe
            const extractedPath = await invoke<string>("download_engine", { name: engineId, url });
            setProgressText(`Downloaded and installed to: ${extractedPath}`);
            setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloading: false, isDownloaded: true } : e));
            // Close modal automatically on success after a short delay so they see the checkmark
            setTimeout(() => {
                setIsAddModalOpen(false);
                setProgressText("");
            }, 1500);
        } catch (e: any) {
            console.error(e);
            setProgressText(`Error: ${e}`);
            setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloading: false } : e));
        }
    };

    const handleRemoveEngine = async (engineId: string) => {
        try {
            await invoke("remove_engine", { name: engineId });
            setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloaded: false } : e));
        } catch (e) {
            console.error("Failed to remove engine:", e);
            alert(`Failed to remove engine: ${e}`);
        }
    };

    const installedEngines = engines.filter(e => e.isDownloaded);
    const availableEngines = engines.filter(e => !e.isDownloaded);

    return (
        <div className="flex flex-col w-full max-w-5xl mx-auto z-10 p-8 h-full overflow-y-auto relative">
            
            {onBack && (
                <button onClick={onBack} className="self-start flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-white mb-6 transition-colors">
                    <ChevronLeft size={16} /> Back to Home
                </button>
            )}

            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        <Cpu size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Engine Management</h1>
                        <p className="text-neutral-400 text-sm">Manage your downloaded UCI engines.</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold flex-shrink-0 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                    <Plus size={20} />
                    Add Engine
                </button>
            </div>

            {/* Installed Engines Grid */}
            {installedEngines.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-neutral-800/20 border border-white/5 rounded-2xl p-12 text-center mt-4">
                    <Cpu size={48} className="text-neutral-600 mb-6" />
                    <h2 className="text-xl font-semibold text-white mb-2">No engines installed</h2>
                    <p className="text-neutral-400 mb-6 max-w-md">You haven't added any secondary UCI engines yet. Click the Add Engine button to browse and install powerful chess AI directly to your computer.</p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-6 py-2 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors font-medium"
                    >
                        Browse Engines
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {installedEngines.map(engine => (
                        <div key={engine.id} className="bg-neutral-800/80 border border-white/10 p-6 rounded-2xl flex flex-col shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-l-2xl"></div>

                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">{engine.name}</h3>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md text-xs font-mono text-neutral-400 border border-white/5">
                                    <Cpu size={14} className="text-blue-400" /> {engine.elo}
                                </div>
                            </div>
                            <p className="text-sm text-neutral-400 mb-6 flex-1 drop-shadow-sm leading-relaxed">
                                {engine.description}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                    <CheckCircle size={14} /> Ready
                                </span>
                                <button 
                                    onClick={() => handleRemoveEngine(engine.id)}
                                    className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Engine Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsAddModalOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="bg-[#161616] border border-white/10 rounded-2xl shadow-2xl relative w-full max-w-5xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#1a1a1a]">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Download Engines</h2>
                                <p className="text-sm text-neutral-400">Select an engine to install locally to your device.</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-2 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Global Progress Bar in Modal */}
                        {progressText && (
                            <div className="bg-blue-600/20 border-b border-blue-500/30 px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-sm font-medium text-blue-200">
                                    <Loader2 size={16} className="animate-spin text-blue-400" />
                                    {progressText}
                                </div>
                            </div>
                        )}

                        {/* Modal List */}
                        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableEngines.map(engine => (
                                <div key={engine.id} className="bg-[#1a1a1a] border border-white/5 p-5 rounded-xl flex flex-col hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-base font-bold text-white">{engine.name}</h3>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded text-xs font-mono text-neutral-400 border border-white/5">
                                            <Cpu size={12} className="text-blue-400" /> {engine.elo}
                                        </div>
                                    </div>
                                    <p className="text-sm text-neutral-400 mb-5 flex-1 leading-relaxed">
                                        {engine.description}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
                                            <HardDrive size={14} /> {engine.size}
                                        </div>

                                        {engine.isDownloading ? (
                                            <button disabled className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 font-semibold text-xs rounded-lg border border-blue-500/20 cursor-wait">
                                                <Loader2 size={14} className="animate-spin" />
                                                Downloading
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDownload(engine.id, engine.url)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-white/10 active:scale-95"
                                            >
                                                <Download size={14} />
                                                Install
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {availableEngines.length === 0 && (
                                <div className="col-span-1 md:col-span-2 text-center py-12 text-neutral-500">
                                    <CheckCircle size={32} className="mx-auto mb-4 opacity-50" />
                                    <p>All featured engines are already installed!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
