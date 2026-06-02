"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Team = {
    id: number;
    team_name: string;
};

export default function NewSeasonGamePage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    const [teams, setTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(true);

    const [homeTeamId, setHomeTeamId] = useState("");
    const [awayTeamId, setAwayTeamId] = useState("");
    const [gameDate, setGameDate] = useState("");
    const [gameTime, setGameTime] = useState("");
    const [location, setLocation] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadTeams() {
            const { id, seasonId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);

            const { data, error } = await supabase
                .from("teams")
                .select("id, team_name")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("team_name", { ascending: true });

            if (error) {
                setError("There was a problem loading teams.");
                setLoadingTeams(false);
                return;
            }

            setTeams(data ?? []);
            setLoadingTeams(false);
        }

        loadTeams();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const { id, seasonId } = await params;

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

            const { error: insertError } = await supabase
                .from("games")
                .insert([
                    {
                        league_id: Number(id),
                        season_id: Number(seasonId),
                        home_team_id: Number(homeTeamId),
                        away_team_id: Number(awayTeamId),
                        game_date: gameDate,
                        game_time: gameTime || null,
                        location: location || null,
                        status: "scheduled",
                    },
                ]);

            if (insertError) {
                setError("There was a problem creating the game.");
                return;
            }

            router.push(`/leagues/${id}/seasons/${seasonId}/schedule`);
        } finally {
            setSaving(false);
        }
    };

    if (loadingTeams) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <p>Loading teams...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Add Game</h1>
                <p className="mt-2 text-gray-600">
                    Create a scheduled game for this season.
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

                {teams.length < 2 && (
                    <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
                        You need at least 2 teams in this season before creating a game.
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">Home Team</label>
                    <select
                        value={homeTeamId}
                        onChange={(e) => setHomeTeamId(e.target.value)}
                        disabled={teams.length < 2}
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
                        disabled={teams.length < 2}
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
                        disabled={saving || teams.length < 2}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Create Game"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule`)
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