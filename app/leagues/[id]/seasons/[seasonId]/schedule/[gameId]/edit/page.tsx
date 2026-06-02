"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Team = {
    id: number;
    team_name: string;
};

export default function EditGamePage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; gameId: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");
    const [gameId, setGameId] = useState("");

    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [homeTeamId, setHomeTeamId] = useState("");
    const [awayTeamId, setAwayTeamId] = useState("");
    const [gameDate, setGameDate] = useState("");
    const [gameTime, setGameTime] = useState("");
    const [location, setLocation] = useState("");

    useEffect(() => {
        async function loadData() {
            const { id, seasonId, gameId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);
            setGameId(gameId);

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("team_name", { ascending: true });

            if (teamsError) {
                setError("There was a problem loading teams.");
                setLoading(false);
                return;
            }

            const { data: game, error: gameError } = await supabase
                .from("games")
                .select("*")
                .eq("id", Number(gameId))
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .single();

            if (gameError || !game) {
                setError("Could not load game.");
                setLoading(false);
                return;
            }

            setTeams(teamsData ?? []);
            setHomeTeamId(
                game.home_team_id !== null && game.home_team_id !== undefined
                    ? String(game.home_team_id)
                    : ""
            );
            setAwayTeamId(
                game.away_team_id !== null && game.away_team_id !== undefined
                    ? String(game.away_team_id)
                    : ""
            );
            setGameDate(game.game_date ?? "");
            setGameTime(game.game_time ?? "");
            setLocation(game.location ?? "");

            setLoading(false);
        }

        loadData();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            if (!homeTeamId || !awayTeamId) {
                setError("Please select both a home team and an away team.");
                return;
            }

            if (homeTeamId === awayTeamId) {
                setError("Home team and away team must be different.");
                return;
            }

            if (!gameDate) {
                setError("Please choose a game date.");
                return;
            }

            const { error: updateError } = await supabase
                .from("games")
                .update({
                    home_team_id: Number(homeTeamId),
                    away_team_id: Number(awayTeamId),
                    game_date: gameDate,
                    game_time: gameTime || null,
                    location: location || null,
                })
                .eq("id", Number(gameId))
                .eq("league_id", Number(leagueId))
                .eq("season_id", Number(seasonId));

            if (updateError) {
                setError("There was a problem updating the game.");
                return;
            }

            router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <p>Loading game...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Edit Game</h1>
                <p className="mt-2 text-gray-600">
                    Set the matchup, date, time, and location for this game.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
            >
                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">Home Team</label>
                    <select
                        value={homeTeamId}
                        onChange={(e) => setHomeTeamId(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                        required
                    >
                        <option value="">Select home team</option>
                        {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.team_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Away Team</label>
                    <select
                        value={awayTeamId}
                        onChange={(e) => setAwayTeamId(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                        required
                    >
                        <option value="">Select away team</option>
                        {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.team_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Game Date</label>
                    <input
                        type="date"
                        value={gameDate}
                        onChange={(e) => setGameDate(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                        required
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Game Time</label>
                    <input
                        type="time"
                        value={gameTime}
                        onChange={(e) => setGameTime(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Location</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Chelsea Piers"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`)
                        }
                        className="rounded-lg border px-6 py-3"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </main>
    );
}