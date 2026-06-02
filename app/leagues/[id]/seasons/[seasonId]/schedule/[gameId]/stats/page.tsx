"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Game = {
    id: number;
    home_team_id: number | null;
    away_team_id: number | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    home_score: number | null;
    away_score: number | null;
};

type Team = {
    id: number;
    team_name: string;
};

type Player = {
    id: number;
    team_id: number;
    first_name: string | null;
    last_name: string | null;
    jersey_number: number | null;
};

type LineupRow = {
    team_id: number;
    player_id: number;
    lineup_slot: string | null;
};

type PlayerStatRow = {
    player_id: number;
    goals: number | null;
    assists: number | null;
    shots: number | null;
};

function displayPlayer(player: Player | undefined) {
    if (!player) return "Not set";

    const fullName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();

    if (player.jersey_number !== null && player.jersey_number !== undefined) {
        return `${fullName} #${player.jersey_number}`;
    }

    return fullName || "Unnamed Player";
}

type PlayerFormStats = {
    goals: string;
    assists: string;
    shots: string;
};

export default function GameStatsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; gameId: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");
    const [gameId, setGameId] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [game, setGame] = useState<Game | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [lineups, setLineups] = useState<LineupRow[]>([]);
    const [playerStats, setPlayerStats] = useState<Record<number, PlayerFormStats>>({});

    useEffect(() => {
        async function loadData() {
            const { id, seasonId, gameId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);
            setGameId(gameId);

            const { data: gameData, error: gameError } = await supabase
                .from("games")
                .select("*")
                .eq("id", Number(gameId))
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .single();

            if (gameError || !gameData) {
                setError("Could not load game.");
                setLoading(false);
                return;
            }

            setGame(gameData);

            const teamIds = [gameData.home_team_id, gameData.away_team_id].filter(
                (value): value is number => value !== null
            );

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .in("id", teamIds.length > 0 ? teamIds : [-1]);

            if (teamsError) {
                setError("There was a problem loading teams.");
                setLoading(false);
                return;
            }

            const { data: lineupData, error: lineupError } = await supabase
                .from("game_lineups")
                .select("team_id, player_id, lineup_slot")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .eq("game_id", Number(gameId))
                .eq("is_in_lineup", true);

            if (lineupError) {
                setError("There was a problem loading lineups.");
                setLoading(false);
                return;
            }

            const lineupRows = (lineupData ?? []) as LineupRow[];
            setLineups(lineupRows);

            const playerIds = Array.from(new Set(lineupRows.map((row) => row.player_id)));

            const { data: playersData, error: playersError } = await supabase
                .from("players")
                .select("id, team_id, first_name, last_name, jersey_number")
                .in("id", playerIds.length > 0 ? playerIds : [-1]);

            if (playersError) {
                setError("There was a problem loading players.");
                setLoading(false);
                return;
            }

            const { data: playerStatsData, error: playerStatsError } = await supabase
                .from("game_player_stats")
                .select("player_id, goals, assists, shots")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .eq("game_id", Number(gameId));

            if (playerStatsError) {
                setError("There was a problem loading player stats.");
                setLoading(false);
                return;
            }

            const initialPlayerStats: Record<number, PlayerFormStats> = {};

            for (const player of (playersData ?? []) as Player[]) {
                initialPlayerStats[player.id] = {
                    goals: "0",
                    assists: "0",
                    shots: "0",
                };
            }

            for (const row of (playerStatsData ?? []) as PlayerStatRow[]) {
                if (initialPlayerStats[row.player_id]) {
                    initialPlayerStats[row.player_id] = {
                        goals: String(row.goals ?? 0),
                        assists: String(row.assists ?? 0),
                        shots: String(row.shots ?? 0),
                    };
                }
            }

            setTeams((teamsData ?? []) as Team[]);
            setPlayers((playersData ?? []) as Player[]);
            setPlayerStats(initialPlayerStats);
            setLoading(false);
        }

        loadData();
    }, [params]);

    const teamNameById = useMemo(() => {
        return new Map<number, string>(teams.map((team) => [team.id, team.team_name]));
    }, [teams]);

    const playersByTeam = useMemo(() => {
        const grouped: Record<number, Player[]> = {};

        for (const player of players) {
            if (!grouped[player.team_id]) {
                grouped[player.team_id] = [];
            }
            grouped[player.team_id].push(player);
        }

        return grouped;
    }, [players]);

    const goalieByTeam = useMemo(() => {
        const goalieMap = new Map<number, number>();

        for (const row of lineups) {
            if (row.lineup_slot === "G1") {
                goalieMap.set(row.team_id, row.player_id);
            }
        }

        return goalieMap;
    }, [lineups]);

    const updatePlayerStat = (
        playerId: number,
        field: keyof PlayerFormStats,
        value: string
    ) => {
        setPlayerStats((current) => ({
            ...current,
            [playerId]: {
                ...current[playerId],
                [field]: value,
            },
        }));
    };

    const getOpponentTeamId = (teamId: number) => {
        if (!game) return null;
        if (game.home_team_id === teamId) return game.away_team_id;
        if (game.away_team_id === teamId) return game.home_team_id;
        return null;
    };

    const getGoalsAllowedForTeam = (teamId: number) => {
        if (!game) return 0;
        if (game.home_team_id === teamId) return Number(game.away_score ?? 0);
        if (game.away_team_id === teamId) return Number(game.home_score ?? 0);
        return 0;
    };

    const getTeamShots = (teamId: number) => {
        const teamPlayers = playersByTeam[teamId] ?? [];
        return teamPlayers.reduce((sum, player) => {
            const isGoalie = goalieByTeam.get(teamId) === player.id;
            if (isGoalie) return sum;

            const shots = Number(playerStats[player.id]?.shots ?? 0);
            return sum + shots;
        }, 0);
    };

    const getGoalieStats = (teamId: number) => {
        const goalieId = goalieByTeam.get(teamId);
        const opponentTeamId = getOpponentTeamId(teamId);
        const opponentShots = opponentTeamId ? getTeamShots(opponentTeamId) : 0;
        const goalsAllowed = getGoalsAllowedForTeam(teamId);
        const saves = Math.max(opponentShots - goalsAllowed, 0);
        const savePercentage = opponentShots > 0 ? (saves / opponentShots).toFixed(3) : "0.000";

        return {
            goalieId,
            saves,
            savePercentage,
        };
    };

    const saveStats = async () => {
        if (!game) return;

        setSaving(true);
        setError("");

        const teamRows = teams.map((team) => ({
            league_id: Number(leagueId),
            season_id: Number(seasonId),
            game_id: Number(gameId),
            team_id: team.id,
            shots_on_goal: getTeamShots(team.id),
        }));

        const playerRows = players.map((player) => {
            const stats = playerStats[player.id] || {
                goals: "0",
                assists: "0",
                shots: "0",
            };

            const isGoalie = goalieByTeam.get(player.team_id) === player.id;
            const goalieStats = getGoalieStats(player.team_id);

            const goals = isGoalie ? 0 : Number(stats.goals || 0);
            const assists = isGoalie ? 0 : Number(stats.assists || 0);
            const shots = isGoalie ? 0 : Number(stats.shots || 0);
            const points = goals + assists;
            const saves = isGoalie ? goalieStats.saves : 0;
            const savePercentage = isGoalie ? Number(goalieStats.savePercentage) : null;

            return {
                league_id: Number(leagueId),
                season_id: Number(seasonId),
                game_id: Number(gameId),
                team_id: player.team_id,
                player_id: player.id,
                goals,
                assists,
                points,
                shots,
                saves,
                save_percentage: savePercentage,
            };
        });

        const { error: deleteTeamStatsError } = await supabase
            .from("game_team_stats")
            .delete()
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId))
            .eq("game_id", Number(gameId));

        if (deleteTeamStatsError) {
            setSaving(false);
            setError(`There was a problem clearing old team stats: ${deleteTeamStatsError.message}`);
            return;
        }

        const { error: deletePlayerStatsError } = await supabase
            .from("game_player_stats")
            .delete()
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId))
            .eq("game_id", Number(gameId));

        if (deletePlayerStatsError) {
            setSaving(false);
            setError(`There was a problem clearing old player stats: ${deletePlayerStatsError.message}`);
            return;
        }

        if (teamRows.length > 0) {
            const { error: insertTeamStatsError } = await supabase
                .from("game_team_stats")
                .insert(teamRows);

            if (insertTeamStatsError) {
                setSaving(false);
                setError(`There was a problem saving team stats: ${insertTeamStatsError.message}`);
                return;
            }
        }

        if (playerRows.length > 0) {
            const { error: insertPlayerStatsError } = await supabase
                .from("game_player_stats")
                .insert(playerRows);

            if (insertPlayerStatsError) {
                setSaving(false);
                setError(`There was a problem saving player stats: ${insertPlayerStatsError.message}`);
                return;
            }
        }

        setSaving(false);
        router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`);
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <p>Loading stats...</p>
            </main>
        );
    }

    if (!game) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">Game not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load that stats page.
                </p>
            </main>
        );
    }

    if (players.length === 0) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">No lineup set</h1>
                <p className="mt-2 text-gray-600">
                    You must set attendance and lineups before entering stats.
                </p>

                <div className="mt-6 flex gap-3">
                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}/attendance`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Set Attendance
                    </Link>

                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}/lineups`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Set Lineups
                    </Link>
                </div>
            </main>
        );
    }

    const teamOrder = [game.home_team_id, game.away_team_id].filter(
        (value): value is number => value !== null
    );

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Enter Stats</h1>
                    <p className="mt-2 text-gray-600">
                        Record stats for players in the lineup. Only players marked "Yes" in attendance and placed into lineups appear here.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}/lineups`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Edit Lineups
                    </Link>

                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Back to Game
                    </Link>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">
                    {(game.home_team_id && teamNameById.get(game.home_team_id)) || "Home Team"} vs{" "}
                    {(game.away_team_id && teamNameById.get(game.away_team_id)) || "Away Team"}
                </p>
                <p className="mt-2 text-gray-600">
                    Score: {game.home_score ?? 0} - {game.away_score ?? 0}
                </p>
                <p className="text-gray-600">Date: {game.game_date || "TBD"}</p>
                <p className="text-gray-600">Location: {game.location || "TBD"}</p>
            </div>

            <div className="space-y-8">
                {teamOrder.map((teamId) => {
                    const goalieStats = getGoalieStats(teamId);
                    const goalie = players.find((player) => player.id === goalieStats.goalieId);

                    return (
                        <div key={teamId} className="rounded-xl border bg-white p-6 shadow-sm">
                            <h2 className="text-2xl font-semibold">
                                {teamNameById.get(teamId) || "Team"}
                            </h2>

                            <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                                <p className="font-medium">Team Shots on Goal</p>
                                <p className="mt-2 text-lg font-semibold">{getTeamShots(teamId)}</p>
                            </div>

                            <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                                <p className="font-medium">Goalie Auto Stats</p>
                                <p className="mt-2 text-sm text-gray-600">
                                    Goalie: {displayPlayer(goalie)}
                                </p>
                                <p className="mt-2 text-sm text-gray-600">
                                    Saves: {goalieStats.saves}
                                </p>
                                <p className="mt-2 text-sm text-gray-600">
                                    Save %: {goalieStats.savePercentage}
                                </p>
                            </div>

                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="border-b text-left">
                                            <th className="px-3 py-2">Player</th>
                                            <th className="px-3 py-2">Goals</th>
                                            <th className="px-3 py-2">Assists</th>
                                            <th className="px-3 py-2">Points</th>
                                            <th className="px-3 py-2">Shots</th>
                                            <th className="px-3 py-2">Saves</th>
                                            <th className="px-3 py-2">Save %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(playersByTeam[teamId] ?? []).map((player) => {
                                            const isGoalie = goalieStats.goalieId === player.id;
                                            const stats = playerStats[player.id] || {
                                                goals: "0",
                                                assists: "0",
                                                shots: "0",
                                            };

                                            const points =
                                                Number(stats.goals || 0) +
                                                Number(stats.assists || 0);

                                            return (
                                                <tr key={player.id} className="border-b">
                                                    <td className="px-3 py-3">
                                                        {displayPlayer(player)}
                                                    </td>

                                                    {!isGoalie ? (
                                                        <>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={stats.goals}
                                                                    onChange={(e) =>
                                                                        updatePlayerStat(
                                                                            player.id,
                                                                            "goals",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-20 rounded-lg border px-3 py-2"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={stats.assists}
                                                                    onChange={(e) =>
                                                                        updatePlayerStat(
                                                                            player.id,
                                                                            "assists",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-20 rounded-lg border px-3 py-2"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">{points}</td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={stats.shots}
                                                                    onChange={(e) =>
                                                                        updatePlayerStat(
                                                                            player.id,
                                                                            "shots",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-20 rounded-lg border px-3 py-2"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">-</td>
                                                            <td className="px-3 py-3">-</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-3 py-3">-</td>
                                                            <td className="px-3 py-3">-</td>
                                                            <td className="px-3 py-3">-</td>
                                                            <td className="px-3 py-3">-</td>
                                                            <td className="px-3 py-3">
                                                                {goalieStats.saves}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {goalieStats.savePercentage}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={saveStats}
                    disabled={saving}
                    className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save Stats"}
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
        </main>
    );
}