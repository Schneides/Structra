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

type AttendanceRow = {
    player_id: number;
    attendance_status: string;
};

type LineupRow = {
    player_id: number;
    team_id: number;
    lineup_slot: string | null;
};

function normalizeAttendanceStatus(status: string | null | undefined) {
    if (status === "in") return "yes";
    if (status === "out") return "no";
    if (status === "yes") return "yes";
    if (status === "no") return "no";
    return "pending";
}

function getPlayerDisplayName(player: Player) {
    const fullName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
    if (player.jersey_number !== null && player.jersey_number !== undefined) {
        return `${fullName} #${player.jersey_number}`;
    }
    return fullName || "Unnamed Player";
}

function formatGameTime(time: string | null) {
    if (!time) return "TBD";

    const [hoursString, minutesString] = time.split(":");
    const hours = Number(hoursString);
    const minutes = Number(minutesString ?? "0");

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

    const suffix = hours >= 12 ? "PM" : "AM";
    const twelveHour = hours % 12 === 0 ? 12 : hours % 12;

    return `${twelveHour}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export default function GameLineupsPage({
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
    const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

    // key format: `${teamId}|${slot}`
    const [slotAssignments, setSlotAssignments] = useState<Record<string, number>>({});

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

            if (teamIds.length === 0) {
                setError("Set the home and away teams before managing lineups.");
                setLoading(false);
                return;
            }

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .in("id", teamIds);

            if (teamsError) {
                setError("There was a problem loading teams.");
                setLoading(false);
                return;
            }

            const { data: playersData, error: playersError } = await supabase
                .from("players")
                .select("id, team_id, first_name, last_name, jersey_number")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .in("team_id", teamIds)
                .order("last_name", { ascending: true });

            if (playersError) {
                setError("There was a problem loading players.");
                setLoading(false);
                return;
            }

            const { data: attendanceData, error: attendanceError } = await supabase
                .from("game_attendance")
                .select("player_id, attendance_status")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .eq("game_id", Number(gameId));

            if (attendanceError) {
                setError("There was a problem loading attendance.");
                setLoading(false);
                return;
            }

            const attendanceMap = new Map<number, string>();
            for (const row of (attendanceData ?? []) as AttendanceRow[]) {
                attendanceMap.set(
                    row.player_id,
                    normalizeAttendanceStatus(row.attendance_status)
                );
            }

            const availablePlayers = ((playersData ?? []) as Player[]).filter(
                (player) => attendanceMap.get(player.id) === "yes"
            );

            const { data: lineupsData, error: lineupsError } = await supabase
                .from("game_lineups")
                .select("player_id, team_id, lineup_slot")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .eq("game_id", Number(gameId));

            if (lineupsError) {
                setError("There was a problem loading lineups.");
                setLoading(false);
                return;
            }

            const initialAssignments: Record<string, number> = {};

            for (const row of (lineupsData ?? []) as LineupRow[]) {
                if (row.lineup_slot) {
                    initialAssignments[`${row.team_id}|${row.lineup_slot}`] = row.player_id;
                }
            }

            setTeams((teamsData ?? []) as Team[]);
            setPlayers(availablePlayers);
            setSlotAssignments(initialAssignments);
            setLoading(false);
        }

        loadData();
    }, [params]);

    const teamNameById = useMemo(() => {
        return new Map<number, string>(teams.map((team) => [team.id, team.team_name]));
    }, [teams]);

    const playerById = useMemo(() => {
        return new Map<number, Player>(players.map((player) => [player.id, player]));
    }, [players]);

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

    const assignedPlayerIds = useMemo(() => {
        return new Set<number>(Object.values(slotAssignments));
    }, [slotAssignments]);

    const getAvailablePlayersForTeam = (teamId: number) => {
        return (playersByTeam[teamId] ?? []).filter(
            (player) => !assignedPlayerIds.has(player.id)
        );
    };

    const assignSelectedPlayerToSlot = (teamId: number, slot: string) => {
        if (!selectedPlayerId) return;

        const selectedPlayer = playerById.get(selectedPlayerId);
        if (!selectedPlayer) return;

        if (selectedPlayer.team_id !== teamId) {
            setError("You can only place a player into their own team lineup.");
            return;
        }

        setError("");

        const newAssignments = { ...slotAssignments };

        for (const key of Object.keys(newAssignments)) {
            if (newAssignments[key] === selectedPlayerId) {
                delete newAssignments[key];
            }
        }

        newAssignments[`${teamId}|${slot}`] = selectedPlayerId;

        setSlotAssignments(newAssignments);
        setSelectedPlayerId(null);
    };

    const removePlayerFromSlot = (teamId: number, slot: string) => {
        const key = `${teamId}|${slot}`;
        const newAssignments = { ...slotAssignments };
        delete newAssignments[key];
        setSlotAssignments(newAssignments);
    };

    const saveLineups = async () => {
        if (!game) return;

        setSaving(true);
        setError("");

        const rowsToInsert = Object.entries(slotAssignments).map(([key, playerId]) => {
            const [teamIdString, lineupSlot] = key.split("|");
            const teamId = Number(teamIdString);

            return {
                league_id: Number(leagueId),
                season_id: Number(seasonId),
                game_id: Number(gameId),
                team_id: teamId,
                player_id: playerId,
                is_in_lineup: true,
                lineup_slot: lineupSlot,
            };
        });

        const { error: deleteError } = await supabase
            .from("game_lineups")
            .delete()
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId))
            .eq("game_id", Number(gameId));

        if (deleteError) {
            setSaving(false);
            setError(`There was a problem clearing old lineups: ${deleteError.message}`);
            return;
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from("game_lineups")
                .insert(rowsToInsert);

            if (insertError) {
                setSaving(false);
                setError(`There was a problem saving lineups: ${insertError.message}`);
                return;
            }
        }

        setSaving(false);
        router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`);
    };

    const renderSlotButton = (teamId: number, slot: string, label: string) => {
        const assignmentKey = `${teamId}|${slot}`;
        const assignedPlayerId = slotAssignments[assignmentKey];
        const assignedPlayer = assignedPlayerId ? playerById.get(assignedPlayerId) : null;

        return (
            <div key={slot} className="rounded-lg border p-3">
                <p className="text-xs font-medium text-gray-500">{label}</p>

                {!assignedPlayer ? (
                    <button
                        type="button"
                        onClick={() => assignSelectedPlayerToSlot(teamId, slot)}
                        className={`mt-2 w-full rounded-lg border border-dashed px-3 py-3 text-left text-sm ${
                            selectedPlayerId ? "hover:bg-gray-50" : "opacity-60"
                        }`}
                    >
                        {selectedPlayerId ? "Click to place selected player" : "Empty"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => removePlayerFromSlot(teamId, slot)}
                        className="mt-2 w-full rounded-lg bg-black px-3 py-3 text-left text-sm text-white"
                    >
                        {getPlayerDisplayName(assignedPlayer)}
                    </button>
                )}
            </div>
        );
    };

    const renderTeamBoard = (teamId: number) => {
        const availablePlayers = getAvailablePlayersForTeam(teamId);

        return (
            <div key={teamId} className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold">
                    {teamNameById.get(teamId) || "Team"}
                </h2>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div>
                        <h3 className="text-lg font-semibold">Available Players</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            Only players who answered “Yes” for attendance can be used.
                        </p>

                        <div className="mt-4 space-y-2">
                            {availablePlayers.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                                    No unassigned available players.
                                </div>
                            ) : (
                                availablePlayers.map((player) => (
                                    <button
                                        key={player.id}
                                        type="button"
                                        onClick={() => {
                                            setError("");
                                            setSelectedPlayerId(player.id);
                                        }}
                                        className={`block w-full rounded-lg border p-3 text-left ${
                                            selectedPlayerId === player.id
                                                ? "bg-black text-white"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        {getPlayerDisplayName(player)}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold">Forwards</h3>
                            <div className="mt-4 space-y-4">
                                {[1, 2, 3, 4].map((line) => (
                                    <div key={`F${line}`}>
                                        <p className="mb-2 text-sm font-medium text-gray-600">
                                            Line {line}
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {renderSlotButton(teamId, `F${line}-LW`, "LW")}
                                            {renderSlotButton(teamId, `F${line}-C`, "C")}
                                            {renderSlotButton(teamId, `F${line}-RW`, "RW")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold">Defense</h3>
                            <div className="mt-4 space-y-4">
                                {[1, 2, 3].map((pair) => (
                                    <div key={`D${pair}`}>
                                        <p className="mb-2 text-sm font-medium text-gray-600">
                                            Pair {pair}
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {renderSlotButton(teamId, `D${pair}-LD`, "LD")}
                                            {renderSlotButton(teamId, `D${pair}-RD`, "RD")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold">Goalie</h3>
                            <div className="mt-4 grid gap-3 md:grid-cols-1">
                                {renderSlotButton(teamId, "G1", "Goalie")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <p>Loading lineups...</p>
            </main>
        );
    }

    if (!game) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">Game not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load lineups for that game.
                </p>
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
                    <h1 className="text-3xl font-bold">Edit Lineups</h1>
                    <p className="mt-2 text-gray-600">
                        Select players who answered yes and place them into lineup slots.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}/attendance`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Attendance
                    </Link>

                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Back to Game
                    </Link>
                </div>
            </div>

            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">
                    {(game.home_team_id && teamNameById.get(game.home_team_id)) || "Home Team"} vs{" "}
                    {(game.away_team_id && teamNameById.get(game.away_team_id)) || "Away Team"}
                </p>
                <p className="mt-2 text-gray-600">Date: {game.game_date || "TBD"}</p>
                <p className="text-gray-600">Time: {formatGameTime(game.game_time)}</p>
                <p className="text-gray-600">Location: {game.location || "TBD"}</p>
            </div>

            {selectedPlayerId && playerById.get(selectedPlayerId) && (
                <div className="mb-6 rounded-lg border bg-blue-50 p-4 text-sm text-blue-800">
                    Selected player: {getPlayerDisplayName(playerById.get(selectedPlayerId)!)}
                </div>
            )}

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {teamOrder.map(renderTeamBoard)}
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={saveLineups}
                    disabled={saving}
                    className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save Lineups"}
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