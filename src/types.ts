export interface UserProfile {
    id: string;
    playerName: string;
    website: "lichess" | "chess.com" | "local";
    username: string;
}
