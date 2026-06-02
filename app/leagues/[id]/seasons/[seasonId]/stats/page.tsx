"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type PlayerSeasonStat = {
    player_id: number;
    team_id: number;
    goals: number | null;
    assists: number | null;
    points: number | null;
    shots: number | null;
    saves: number | null;
    save_percentage: number | null;
};

type Player = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    jersey_number: number | null;
    team_id: number | null;
};

type Team = {
    id: number;
    team_name: string;
};

type Season = {
    id: number;
    season_name: string;
    league_id: number;
};

type League = {
    id: number;
    league_name: string;
};

type AggregatedPlayerStat = {
    playerId: number;
    teamId: number;
    playerName: string;
    jerseyNumber: number | null;
    teamName: string;
    goals: number;
    assists: number;
    points: number;
    shots: number;
    saves: number;
    gamesPlayed: number;
    savePercentage: number | null;
    isGoalie: boolean;
};

function playerDisplay(
    firstName: string | null,
    lastName: string | null,
    jerseyNumber: number | null
) {
    const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unnamed Player";

    if (jerseyNumber !== null && jerseyNumber !== undefined) {
        return `${fullName} #${jerseyNumber}`;
    }

    return fullName;
}

function formatSavePercentage(value: number | null) {
    if (value === null || value === undefined) return "-";
    return value.toFixed(3);
}

export default function SeasonStatsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    const [league, setLeague] = useState<League | null>(null);
    const [season, setSeason] = useState<Season | null>(null);
    const [allPlayers, setAllPlayers] = useState<AggregatedPlayerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [skaterSort, setSkaterSort] = useState("points");
    const [goalieSort, setGoalieSort] = useState("save_percentage");

    useEffect(() => {
        async function loadData() {
            const resolvedParams = await params;
            const id = resolvedParams.id;
            const currentSeasonId = resolvedParams.seasonId;

            setLeagueId(id);
            setSeasonId(currentSeasonId);

            const { data: leagueData, error: leagueError } = await supabase
                .from("leagues")
                .select("id, league_name")
                .eq("id", Number(id))
                .single();

            const { data: seasonData, error: seasonError } = await supabase
                .from("seasons")
                .select("id, season_name, league_id")
                .eq("id", Number(currentSeasonId))
                .eq("league_id", Number(id))
                .single();

            if (leagueError || !leagueData || seasonError || !seasonData) {
                setError("We could not load that season stats page.");
                setLoading(false);
                return;
            }

            setLeague(leagueData as League);
            setSeason(seasonData as Season);

            const { data: rawStats, error: statsError } = await supabase
                .from("game_player_stats")
                .select("player_id, team_id, goals, assists, points, shots, saves, save_percentage")
                .eq("league_id", Number(id))
                .eq("season_id", Number(currentSeasonId));

            if (statsError) {
                setError("There was a problem loading season stats.");
                setLoading(false);
                return;
            }

            const statsRows = (rawStats ?? []) as PlayerSeasonStat[];

            const playerIds = Array.from(new Set(statsRows.map((row) => row.player_id)));
            const teamIds = Array.from(new Set(statsRows.map((row) => row.team_id)));

            const { data: playersData, error: playersError } = await supabase
                .from("players")
                .select("id, first_name, last_name, jersey_number, team_id")
                .in("id", playerIds.length > 0 ? playerIds : [-1]);

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .in("id", teamIds.length > 0 ? teamIds : [-1]);

            if (playersError || teamsError) {
                setError("There was a problem loading player or team details.");
                setLoading(false);
                return;
            }

            const players = (playersData ?? []) as Player[];
            const teams = (teamsData ?? []) as Team[];

            const playerById = new Map<number, Player>(
                players.map((player) => [player.id, player])
            );

            const teamById = new Map<number, Team>(
                teams.map((team) => [team.id, team])
            );

            const aggregatedMap = new Map<number, AggregatedPlayerStat>();

            for (const row of statsRows) {
                const player = playerById.get(row.player_id);
                if (!player) continue;

                const team = teamById.get(row.team_id);

                if (!aggregatedMap.has(row.player_id)) {
                    aggregatedMap.set(row.player_id, {
                        playerId: row.player_id,
                        teamId: row.team_id,
                        playerName: playerDisplay(
                            player.first_name,
                            player.last_name,
                            player.jersey_number
                        ),
                        jerseyNumber: player.jersey_number,
                        teamName: team?.team_name || "Unknown Team",
                        goals: 0,
                        assists: 0,
                        points: 0,
                        shots: 0,
                        saves: 0,
                        gamesPlayed: 0,
                        savePercentage: null,
                        isGoalie: false,
                    });
                }

                const current = aggregatedMap.get(row.player_id)!;

                current.goals += Number(row.goals ?? 0);
                current.assists += Number(row.assists ?? 0);
                current.points += Number(row.points ?? 0);
                current.shots += Number(row.shots ?? 0);
                current.saves += Number(row.saves ?? 0);
                current.gamesPlayed += 1;

                if (Number(row.saves ?? 0) > 0 || row.save_percentage !== null) {
                    current.isGoalie = true;
                }
            }

            for (const player of aggregatedMap.values()) {
                const playerRows = statsRows.filter((row) => row.player_id === player.playerId);

                const goalieRows = playerRows.filter(
                    (row) => row.save_percentage !== null || Number(row.saves ?? 0) > 0
                );

                if (goalieRows.length > 0) {
                    const averageSavePct =
                        goalieRows.reduce(
                            (sum, row) => sum + Number(row.save_percentage ?? 0),
                            0
                        ) / goalieRows.length;

                    player.savePercentage = averageSavePct;
                }
            }

            setAllPlayers(Array.from(aggregatedMap.values()));
            setLoading(false);
        }

        loadData();
    }, [params]);

    const skaters = useMemo(() => {
        const filtered = allPlayers.filter((player) => !player.isGoalie);

        return [...filtered].sort((a, b) => {
            if (skaterSort === "goals") {
                if (b.goals !== a.goals) return b.goals - a.goals;
                if (b.points !== a.points) return b.points - a.points;
                return a.playerName.localeCompare(b.playerName);
            }

            if (skaterSort === "assists") {
                if (b.assists !== a.assists) return b.assists - a.assists;
                if (b.points !== a.points) return b.points - a.points;
                return a.playerName.localeCompare(b.playerName);
            }

            if (skaterSort === "shots") {
                if (b.shots !== a.shots) return b.shots - a.shots;
                if (b.points !== a.points) return b.points - a.points;
                return a.playerName.localeCompare(b.playerName);
            }

            if (b.points !== a.points) return b.points - a.points;
            if (b.goals !== a.goals) return b.goals - a.goals;
            return a.playerName.localeCompare(b.playerName);
        });
    }, [allPlayers, skaterSort]);

    const goalies = useMemo(() => {
        const filtered = allPlayers.filter((player) => player.isGoalie);

        return [...filtered].sort((a, b) => {
            if (goalieSort === "saves") {
                if (b.saves !== a.saves) return b.saves - a.saves;
                const aPct = a.savePercentage ?? 0;
                const bPct = b.savePercentage ?? 0;
                if (bPct !== aPct) return bPct - aPct;
                return a.playerName.localeCompare(b.playerName);
            }

            if (goalieSort === "games_played") {
                if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
                if (b.saves !== a.saves) return b.saves - a.saves;
                return a.playerName.localeCompare(b.playerName);
            }

            const aPct = a.savePercentage ?? 0;
            const bPct = b.savePercentage ?? 0;
            if (bPct !== aPct) return bPct - aPct;
            if (b.saves !== a.saves) return b.saves - a.saves;
            return a.playerName.localeCompare(b.playerName);
        });
    }, [allPlayers, goalieSort]);

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-6 py-10">
                <p>Loading season stats...</p>
            </main>
        );
    }

    if (error || !league || !season) {
        return (
            <main className="mx-auto max-w-7xl px-6 py-10">
                <h1 className="text-3xl font-bold">Season stats unavailable</h1>
                <p className="mt-2 text-gray-600">
                    {error || "We could not load that season stats page."}
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Season Stats</h1>
                    <p className="mt-2 text-gray-600">
                        {league.league_name} • {season.season_name}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        Player stats are calculated from completed games, saved scores, and lineup selections.
                    </p>
                </div>

                <Link
                    href={`/leagues/${leagueId}/seasons/${seasonId}`}
                    className="rounded-lg border px-5 py-3"
                >
                    Back to Season
                </Link>
            </div>

            {allPlayers.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No stats yet</h2>
                    <p className="mt-2 text-gray-600">
                        Enter game stats to populate season leaders.
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    <section className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-semibold">Skater Leaders</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    Sort skaters by points, goals, assists, or shots.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Sort by</label>
                                <select
                                    value={skaterSort}
                                    onChange={(e) => setSkaterSort(e.target.value)}
                                    className="rounded-lg border px-3 py-2 text-sm"
                                >
                                    <option value="points">Points</option>
                                    <option value="goals">Goals</option>
                                    <option value="assists">Assists</option>
                                    <option value="shots">Shots</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 overflow-x-auto">
                            <table className="min-w-full border-collapse">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="px-3 py-2">Player</th>
                                        <th className="px-3 py-2">Team</th>
                                        <th className="px-3 py-2">GP</th>
                                        <th className="px-3 py-2">G</th>
                                        <th className="px-3 py-2">A</th>
                                        <th className="px-3 py-2">PTS</th>
                                        <th className="px-3 py-2">SOG</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {skaters.map((player) => (
                                        <tr key={player.playerId} className="border-b">
                                            <td className="px-3 py-3">
                                                <Link
                                                    href={`/leagues/${leagueId}/seasons/${seasonId}/teams/${player.teamId}/roster/${player.playerId}`}
                                                    className="hover:underline"
                                                >
                                                    {player.playerName}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-3">{player.teamName}</td>
                                            <td className="px-3 py-3">{player.gamesPlayed}</td>
                                            <td className="px-3 py-3">{player.goals}</td>
                                            <td className="px-3 py-3">{player.assists}</td>
                                            <td className="px-3 py-3 font-semibold">
                                                {player.points}
                                            </td>
                                            <td className="px-3 py-3">{player.shots}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-semibold">Goalie Leaders</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    Goalie totals are based on saved game stats and lineup goalie assignments.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Sort by</label>
                                <select
                                    value={goalieSort}
                                    onChange={(e) => setGoalieSort(e.target.value)}
                                    className="rounded-lg border px-3 py-2 text-sm"
                                >
                                    <option value="save_percentage">Save %</option>
                                    <option value="saves">Saves</option>
                                    <option value="games_played">Games Played</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 overflow-x-auto">
                            <table className="min-w-full border-collapse">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="px-3 py-2">Player</th>
                                        <th className="px-3 py-2">Team</th>
                                        <th className="px-3 py-2">GP</th>
                                        <th className="px-3 py-2">Saves</th>
                                        <th className="px-3 py-2">SV%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {goalies.map((player) => (
                                        <tr key={player.playerId} className="border-b">
                                            <td className="px-3 py-3">
                                                <Link
                                                    href={`/leagues/${leagueId}/seasons/${seasonId}/teams/${player.teamId}/roster/${player.playerId}`}
                                                    className="hover:underline"
                                                >
                                                    {player.playerName}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-3">{player.teamName}</td>
                                            <td className="px-3 py-3">{player.gamesPlayed}</td>
                                            <td className="px-3 py-3">{player.saves}</td>
                                            <td className="px-3 py-3 font-semibold">
                                                {formatSavePercentage(player.savePercentage)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}