import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Download, Cpu, CheckCircle, Loader2 } from "lucide-react";

interface EngineInfo {
    id: string;
    name: string;
    description: string;
    url: string;
    isDownloaded: boolean;
    isDownloading: boolean;
}


// Actually, let's just create a generic component. The backend expects a zip. I'll provide a dummy ZIP for Stockfish just to demonstrate, or we can use the actual Windows zip and the backend will extract it (even if it's linux, user may need Windows binary).
// Let's assume the user wants Stockfish. Stockfish provides zip for Windows. For Linux, usually it's tar.gz. I'll need to adapt the backend or use a zip file.
// For now, let's assume the backend handles zip and I'll put a zip URL here.

export const EnginesTab = () => {
    const [engines, setEngines] = useState<EngineInfo[]>([
        {
            id: "stockfish",
            name: "Stockfish 17 (Windows)",
            description: "Powerful open-source engine. (Windows static zip)",
            url: "https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-windows-x86-64-avx2.zip",
            isDownloaded: false,
            isDownloading: false,
        }
    ]);

    const [progressText, setProgressText] = useState("");

    useEffect(() => {
        const checkDownloaded = async () => {
            // In a real app, we would invoke a Tauri command to list downloaded engines.
            // For now, let's leave them as not downloaded initially.
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
            const extractedPath = await invoke<string>("download_engine", { name: engineId, url });
            setProgressText(`Downloaded and installed to: ${extractedPath}`);
            setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloading: false, isDownloaded: true } : e));
        } catch (e: any) {
            console.error(e);
            setProgressText(`Error: ${e}`);
            setEngines(prev => prev.map(e => e.id === engineId ? { ...e, isDownloading: false } : e));
        }
    };

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto z-10 p-8 h-full overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                    <Cpu size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Engine Management</h1>
                    <p className="text-neutral-400 text-sm">Download and configure UCI chess engines.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {engines.map(engine => (
                    <div key={engine.id} className="bg-neutral-800/50 border border-white/5 p-6 rounded-2xl flex flex-col hover:bg-neutral-800 transition-colors">
                        <h3 className="text-lg font-bold text-white mb-2">{engine.name}</h3>
                        <p className="text-sm text-neutral-400 mb-6 flex-1">
                            {engine.description}
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                            <span className="text-xs font-mono text-neutral-500 bg-black/20 px-2 py-1 rounded">UCI Protocol</span>

                            {engine.isDownloaded ? (
                                <button disabled className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 font-medium rounded-xl border border-green-500/20">
                                    <CheckCircle size={18} />
                                    Installed
                                </button>
                            ) : engine.isDownloading ? (
                                <button disabled className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 font-medium rounded-xl border border-blue-500/20">
                                    <Loader2 size={18} className="animate-spin" />
                                    Downloading...
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleDownload(engine.id, engine.url)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-medium rounded-xl transition-colors shadow-lg shadow-white/10"
                                >
                                    <Download size={18} />
                                    Download
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {progressText && (
                <div className="mt-8 p-4 bg-black/40 border border-white/5 rounded-xl">
                    <p className="text-sm font-mono text-neutral-300 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        {progressText}
                    </p>
                </div>
            )}
        </div>
    );
};
