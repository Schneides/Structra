import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

"use client";


type DraftPick = {
    id: number;
    player_id: number | null;
    draft_player_id: number | null;
};

type Game = {
    id: number;
    status: string | null;
    home_score?: number | null;
    away_score?: number | null;
};

export default function RedoDraftPage({
    params,
}: {
    params: { id: string; seasonId: string };
}) {
    const { id, seasonId } = params;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState("");
    const [leagueName, setLeagueName] = useState("");
    const [seasonName, setSeasonName] = useState("");
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [gamesStarted, setGamesStarted] = useState(false);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError("");

            const leagueNumber = Number(id);
            const seasonNumber = Number(seasonId);

            const { data: leagueData } = await supabase
                .from("leagues")
                .select("league_name")
                .eq("id", leagueNumber)
                .single();

            const { data: seasonData } = await supabase
                .from("seasons")
                .select("season_name")
                .eq("id", seasonNumber)
                .eq("league_id", leagueNumber)
                .single();

            const { data: picksData, error: picksError } = await supabase
                .from("draft_picks")
                .select("id, player_id, draft_player_id")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber);

            if (picksError) {
                setError("There was a problem loading draft picks.");
                setLoading(false);
                return;
            }

            let gamesData: Game[] = [];

            const gamesWithScores = await supabase
                .from("games")
                .select("id, status, home_score, away_score")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber);

            if (!gamesWithScores.error) {
                gamesData = (gamesWithScores.data ?? []) as Game[];
            } else {
                const gamesWithoutScores = await supabase
                    .from("games")
                    .select("id, status")
                    .eq("league_id", leagueNumber)
                    .eq("season_id", seasonNumber);

                gamesData = (gamesWithoutScores.data ?? []) as Game[];
            }

            const hasStartedGame = gamesData.some((game) => {
                const status = (game.status ?? "").toLowerCase();

                return (
                    status === "completed" ||
                    status === "final" ||
                    status === "played" ||
                    game.home_score !== null ||
                    game.away_score !== null
                );
            });

            setLeagueName(leagueData?.league_name ?? "");
            setSeasonName(seasonData?.season_name ?? "");
            setDraftPicks((picksData ?? []) as DraftPick[]);
            setGamesStarted(hasStartedGame);
            setLoading(false);
        }

        loadData();
    }, [id, seasonId]);

    const redoDraft = async () => {
        const confirmed = confirm(
            "Redoing the draft will delete all draft picks, remove drafted roster players, reopen the draft, and keep team captains/alternate captains in place. This should only be done before games are played. Continue?"
        );

        if (!confirmed) return;

        setResetting(true);
        setError("");

        const leagueNumber = Number(id);
        const seasonNumber = Number(seasonId);

        const rosterPlayerIds = draftPicks
            .map((pick) => pick.player_id)
            .filter((playerId): playerId is number => playerId !== null);

        if (rosterPlayerIds.length > 0) {
            const { error: deletePlayersError } = await supabase
                .from("players")
                .delete()
                .in("id", rosterPlayerIds)
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber);

            if (deletePlayersError) {
                setResetting(false);
                setError(deletePlayersError.message || "There was a problem removing drafted roster players.");
                return;
            }
        }

        const { error: deletePicksError } = await supabase
            .from("draft_picks")
            .delete()
            .eq("league_id", leagueNumber)
            .eq("season_id", seasonNumber);

        if (deletePicksError) {
            setResetting(false);
            setError(deletePicksError.message || "There was a problem clearing draft picks.");
            return;
        }

        const { error: resetDraftPlayersError } = await supabase
            .from("draft_players")
            .update({
                drafted_team_id: null,
                is_substitute: false,
            })
            .eq("league_id", leagueNumber)
            .eq("season_id", seasonNumber);

        if (resetDraftPlayersError) {
            setResetting(false);
            setError(resetDraftPlayersError.message || "There was a problem resetting draft players.");
            return;
        }

        const { error: reopenSeasonError } = await supabase
            .from("seasons")
            .update({
                draft_completed_at: null,
            })
            .eq("id", seasonNumber)
            .eq("league_id", leagueNumber);

        if (reopenSeasonError) {
            setResetting(false);
            setError(reopenSeasonError.message || "There was a problem reopening the draft.");
            return;
        }

        setResetting(false);
        router.push(`/leagues/${id}/seasons/${seasonId}/draft`);
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-4xl px-6 py-10">
                <p>Loading redo draft options...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-4xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Redo Draft</h1>
                    <p className="mt-2 text-gray-600">
                        {leagueName} • {seasonName}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        Reset draft selections only if the league has not started games yet.
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/draft`}
                    className="rounded-lg border px-5 py-3 hover:bg-gray-50"
                >
                    Back to Draft
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <section className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">What this will reset</h2>

                <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p>• Deletes all draft pick history for this season.</p>
                    <p>• Removes roster players created by draft picks.</p>
                    <p>• Reopens the draft board.</p>
                    <p>• Keeps teams, team names, captains, alternate captains, and draft order.</p>
                    <p>• Returns drafted players back to the available draft pool.</p>
                </div>

                <div className="mt-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                    This is only recommended before games are played. Once scores, stats, or game results exist, redrafting can break the league history.
                </div>

                {gamesStarted ? (
                    <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                        Redo Draft is locked because a game appears to have been played or scored.
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={redoDraft}
                        disabled={resetting || draftPicks.length === 0}
                        className="mt-6 rounded-lg bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {resetting ? "Resetting Draft..." : "Redo Draft"}
                    </button>
                )}
            </section>
        </main>
    );
}