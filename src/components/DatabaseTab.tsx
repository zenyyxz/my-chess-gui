import { useState } from "react";
import { UserProfile } from "../types";
import { Database, Search, UserCircle, History, Trophy, TrendingUp } from "lucide-react";

interface DatabaseTabProps {
    profiles: UserProfile[];
}

export const DatabaseTab = ({ profiles }: DatabaseTabProps) => {
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profiles.length > 0 ? profiles[0].id : null);

    if (profiles.length === 0) {
        return (
            <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#161616]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="flex flex-col items-center justify-center text-center max-w-md z-10">
                    <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        <Database size={40} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-3">No Profiles Linked</h1>
                    <p className="text-neutral-400 text-sm mb-8">
                        Create a profile in the Users tab to view your games and statistics in the database.
                    </p>
                </div>
            </main>
        );
    }

    const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

    return (
        <main className="flex-1 flex bg-[#161616] relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Sidebar: Profile List */}
            <aside className="w-[300px] h-full bg-[#111111] border-r border-white/5 flex flex-col z-10 flex-shrink-0">
                <div className="p-5 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database size={20} className="text-blue-500" />
                        Database
                    </h2>
                    <p className="text-sm text-neutral-500 mt-1">Select a profile to analyze games.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                    {profiles.map(profile => (
                        <button
                            key={profile.id}
                            onClick={() => setSelectedProfileId(profile.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${selectedProfileId === profile.id
                                    ? "bg-blue-500/10 border-blue-500/30 shadow-[0_4px_12px_rgba(59,130,246,0.1)]"
                                    : "bg-white/5 border-transparent hover:bg-white/10"
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-[#f2f2f2]">{profile.username}</span>
                                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded tracking-wider">
                                    {profile.website}
                                </span>
                            </div>
                            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                                <UserCircle size={14} />
                                {profile.playerName}
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full z-10">

                {/* Header toolbar */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#1a1a1a]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg uppercase shadow-inner border border-blue-500/30">
                            {selectedProfile.username.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-lg leading-tight">{selectedProfile.username}</h2>
                            <div className="text-xs text-neutral-500 flex gap-2">
                                <span>{selectedProfile.playerName}</span>
                                <span>•</span>
                                <span className="capitalize">{selectedProfile.website}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-blue-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search games..."
                                className="bg-[#252525] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50 w-64 transition-colors"
                                disabled
                            />
                        </div>
                        <button className="px-4 py-2 bg-[#252525] hover:bg-[#303030] text-sm text-white font-medium rounded-lg border border-white/10 transition-colors">
                            Filter
                        </button>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Win Rate</div>
                                <div className="text-2xl font-bold text-white">52.4%</div>
                            </div>
                        </div>
                        <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                                <History size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Total Games</div>
                                <div className="text-2xl font-bold text-white">1,402</div>
                            </div>
                        </div>
                        <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Current Rating</div>
                                <div className="text-2xl font-bold text-white">1840</div>
                            </div>
                        </div>
                    </div>

                    {/* Games List Placeholder */}
                    <div className="flex-1 bg-[#1e1e1e] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#202020]">
                            <h3 className="font-bold text-white">Recent Games</h3>
                            <span className="text-xs text-neutral-500">Showing last 10 games</span>
                        </div>

                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                                <Database size={24} className="text-neutral-500" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">Database Not Synced</h4>
                            <p className="text-sm text-neutral-400 max-w-sm mb-6">
                                Games have not been downloaded for this profile yet. Click "Sync" to fetch your game history from {selectedProfile.website}.
                            </p>
                            <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                                Sync Database
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
};
