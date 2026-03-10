import { useState } from "react";
import { Users, X } from "lucide-react";

interface UserProfile {
    id: string;
    playerName: string;
    website: "lichess" | "chess.com" | "local";
    username: string;
}

export const UsersTab = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);

    const handleAddProfile = (profile: Omit<UserProfile, "id">) => {
        setProfiles(prev => [...prev, { ...profile, id: Date.now().toString() }]);
        setIsModalOpen(false);
    };

    return (
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#161616]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            {profiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center max-w-md z-10">
                    <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        <Users size={40} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Users & Profiles</h1>
                    <p className="text-neutral-400 text-sm mb-8">
                        Manage local player profiles, view statistics, and configure ratings.
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-6 py-3 bg-[#1e61d4] hover:bg-[#2568e6] text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                    >
                        Add Profile
                    </button>
                </div>
            ) : (
                <div className="w-full h-full max-w-4xl z-10 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                                <Users size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Users & Profiles</h1>
                                <p className="text-neutral-400 text-sm">Manage local player profiles, view statistics, and configure ratings.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-5 py-2.5 bg-[#1e61d4] hover:bg-[#2568e6] text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                        >
                            Add Profile
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {profiles.map(p => (
                            <div key={p.id} className="bg-[#1f1f1f] border border-white/5 p-6 rounded-2xl flex flex-col hover:bg-[#252525] transition-colors relative">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded capitalize">{p.website}</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{p.username}</h3>
                                <p className="text-sm text-neutral-400">Player: {p.playerName}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <AddAccountModal
                    onClose={() => setIsModalOpen(false)}
                    onAdd={handleAddProfile}
                />
            )}
        </main>
    );
};

interface AddAccountModalProps {
    onClose: () => void;
    onAdd: (profile: Omit<UserProfile, "id">) => void;
}

const AddAccountModal = ({ onClose, onAdd }: AddAccountModalProps) => {
    const [playerName, setPlayerName] = useState("");
    const [website, setWebsite] = useState<"lichess" | "chess.com">("lichess");
    const [username, setUsername] = useState("");
    const [loginBrowser, setLoginBrowser] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            playerName: playerName || "Local Player", // Fallback if empty
            website,
            username
        });
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-[460px] shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h2 className="text-lg font-medium text-[#dcdcdc]">Add Account</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">

                    {/* Player Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[15px] font-normal text-[#dcdcdc]">Player Name</label>
                        <span className="text-[13px] text-neutral-500 mb-1 leading-snug">
                            Group multiple accounts belonging to one player
                        </span>
                        <input
                            type="text"
                            placeholder="Select player"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full bg-[#202020] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-[15px]"
                        />
                    </div>

                    {/* Website */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[15px] font-normal text-[#dcdcdc]">
                            Website <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <button
                                type="button"
                                onClick={() => setWebsite("lichess")}
                                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${website === "lichess"
                                        ? "bg-[#252525] border-blue-500"
                                        : "bg-[#252525] border-transparent hover:bg-[#2a2a2a]"
                                    }`}
                            >
                                {/* Minimalist Horse SVG matching Lichess logo style */}
                                <svg width="24" height="24" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M22 44C34.1503 44 44 34.1503 44 22C44 9.84973 34.1503 0 22 0C9.84973 0 0 9.84973 0 22C0 34.1503 9.84973 44 22 44ZM17.4045 10.9995C17.4045 10.9995 19.8272 13.0645 20.9328 14.7335C21.9056 16.2023 23.3683 17.5852 23.3683 17.5852C23.3683 17.5852 23.8344 19.3364 25.1278 20.3235C26.4213 21.3106 28.5208 21.6429 28.5208 21.6429C28.5208 21.6429 29.5 22.1818 29.5 23.109C29.5 24.0363 28.5208 24.3636 28.5208 24.3636C28.5208 24.3636 23.8633 24.7176 22.8465 24.646C19.9822 24.4443 17.7788 23.1554 16.7909 22.4646C15.6881 21.6936 14.1804 19.6429 14.1804 19.6429C14.1804 19.6429 14.8384 18.2323 15.6881 17.5852C16.8996 16.6626 18.0673 16.2023 18.0673 16.2023C18.0673 16.2023 15.6881 16.6626 13.9118 17.5852C12.1354 18.5078 10.9023 20.3235 10.9023 20.3235C10.9023 20.3235 10.3634 19.6429 10.6384 18.0673C10.9134 16.4917 12.3168 14.7335 13.9118 12.7937C15.5068 10.8539 17.4045 10.9995 17.4045 10.9995Z" fill="white" fillOpacity="0.9" />
                                    <path d="M12.9239 27.5C12.9239 27.5 15.1157 26.25 18.1065 26.25C21.0973 26.25 24.3312 27.5 24.3312 27.5L25.6823 35.8043C25.6823 35.8043 23.2355 37.1522 18.5277 37.1522C13.8199 37.1522 12 35.8043 12 35.8043L12.9239 27.5Z" fill="white" fillOpacity="0.9" />
                                </svg>
                                <span className="text-[15px] font-normal text-[#dcdcdc]">Lichess</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setWebsite("chess.com")}
                                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${website === "chess.com"
                                        ? "bg-[#252525] border-blue-500"
                                        : "bg-[#252525] border-transparent hover:bg-[#2a2a2a]"
                                    }`}
                            >
                                {/* Pawn SVG for Chess.com */}
                                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#759f51]">
                                    <path d="M16 2C13.2386 2 11 4.23858 11 7C11 9.49755 12.8306 11.5677 15.228 11.9472C14.49 12.8984 13.5654 13.7915 12.5186 14.5676C10.6301 15.9682 9.07185 17.5147 8.01981 19.3082C7.99955 19.3428 7.97828 19.3808 7.95466 19.4231C7.30758 20.5841 7 21.6708 7 22.5C7 24.5173 8.7616 26.3146 11.2335 27.3512L9 28H23L20.7665 27.3512C23.2384 26.3146 25 24.5173 25 22.5C25 21.6708 24.6924 20.5841 24.0453 19.4231C24.0217 19.3808 24.0005 19.3428 23.9802 19.3082C22.9282 17.5147 21.3699 15.9682 19.4814 14.5676C18.4346 13.7915 17.5101 12.8984 16.772 11.9472C19.1694 11.5677 21 9.49755 21 7C21 4.23858 18.7614 2 16 2Z" fill="currentColor" />
                                    <rect x="7" y="29" width="18" height="2" rx="1" fill="currentColor" />
                                </svg>
                                <span className="text-[15px] font-normal text-[#dcdcdc]">Chess.com</span>
                            </button>
                        </div>
                    </div>

                    {/* Username */}
                    <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-[15px] font-normal text-[#dcdcdc]">
                            Username <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-[#202020] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-[15px]"
                        />
                    </div>

                    {/* Login with browser checkbox */}
                    <div className="flex items-start gap-3 mt-1">
                        <div className="flex items-center h-6">
                            <input
                                type="checkbox"
                                id="login-browser"
                                checked={loginBrowser}
                                onChange={(e) => setLoginBrowser(e.target.checked)}
                                className="w-4 h-4 rounded bg-[#1f1f1f] border-white/10 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0 focus:ring-2 cursor-pointer"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="login-browser" className="text-[15px] font-normal text-[#dcdcdc] cursor-pointer cursor-default leading-snug">
                                Login with browser
                            </label>
                            <span className="text-[13px] text-neutral-500">
                                Allows faster game downloads
                            </span>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full mt-4 py-2.5 bg-[#1e74d4] hover:bg-[#2381ea] text-white font-semibold rounded-lg shadow-sm transition-colors text-[15px]"
                    >
                        Add
                    </button>

                </form>
            </div>
        </div>
    );
};
