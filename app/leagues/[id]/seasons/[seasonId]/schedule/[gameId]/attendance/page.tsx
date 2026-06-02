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
    id: number;
    player_id: number;
    attendance_status: string;
};

function normalizeAttendanceStatus(status: string | null | undefined) {
    if (status === "in") return "yes";
    if (status === "out") return "no";
    if (status === "yes") return "yes";
    if (status === "no") return "no";
    return "pending";
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

export default function GameAttendancePage({
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
    const [attendanceByPlayer, setAttendanceByPlayer] = useState<Record<number, string>>({});

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
                setError("Set the home and away teams before managing attendance.");
                setLoading(false);
                return;
            }

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .in("id", teamIds)
                .order("team_name", { ascending: true });

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
                .select("id, player_id, attendance_status")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .eq("game_id", Number(gameId));

            if (attendanceError) {
                setError("There was a problem loading attendance.");
                setLoading(false);
                return;
            }

            const attendanceMap: Record<number, string> = {};

            for (const row of (attendanceData ?? []) as AttendanceRow[]) {
                attendanceMap[row.player_id] = normalizeAttendanceStatus(
                    row.attendance_status
                );
            }

            for (const player of (playersData ?? []) as Player[]) {
                if (!attendanceMap[player.id]) {
                    attendanceMap[player.id] = "pending";
                }
            }

            setTeams((teamsData ?? []) as Team[]);
            setPlayers((playersData ?? []) as Player[]);
            setAttendanceByPlayer(attendanceMap);
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

    const updateAttendance = (playerId: number, status: string) => {
        setAttendanceByPlayer((current) => ({
            ...current,
            [playerId]: status,
        }));
    };

    const saveAttendance = async () => {
        if (!game) return;

        setSaving(true);
        setError("");

        const rowsToInsert = players.map((player) => ({
            league_id: Number(leagueId),
            season_id: Number(seasonId),
            game_id: Number(gameId),
            team_id: player.team_id,
            player_id: player.id,
            attendance_status: attendanceByPlayer[player.id] || "pending",
        }));

        const { error: deleteError } = await supabase
            .from("game_attendance")
            .delete()
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId))
            .eq("game_id", Number(gameId));

        if (deleteError) {
            setSaving(false);
            setError(`There was a problem clearing old attendance: ${deleteError.message}`);
            return;
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from("game_attendance")
                .insert(rowsToInsert);

            if (insertError) {
                setSaving(false);
                setError(`There was a problem saving attendance: ${insertError.message}`);
                return;
            }
        }

        setSaving(false);
        router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`);
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <p>Loading attendance...</p>
            </main>
        );
    }

    if (!game) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">Game not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load attendance for that game.
                </p>
            </main>
        );
    }

    const teamOrder = [game.home_team_id, game.away_team_id].filter(
        (value): value is number => value !== null
    );

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Game Attendance</h1>
                    <p className="mt-2 text-gray-600">
                        Set each player&apos;s availability before building lineups.
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        Pending means no response yet. Yes means the player is attending. No means the player is unavailable.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}/edit`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Edit Game
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
                <p className="mt-2 text-gray-600">
                    Date: {game.game_date || "TBD"}
                </p>
                <p className="text-gray-600">
                    Time: {formatGameTime(game.game_time)}
                </p>
                <p className="text-gray-600">
                    Location: {game.location || "TBD"}
                </p>
            </div>

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                {teamOrder.map((teamId) => (
                    <div key={teamId} className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-2xl font-semibold">
                                {teamNameById.get(teamId) || "Team"}
                            </h2>
                            <p className="mt-2 text-sm text-gray-500">
                                Set each player&apos;s availability for this game.
                            </p>
                        </div>

                        <div className="mt-4 space-y-3">
                            {(playersByTeam[teamId] ?? []).length === 0 ? (
                                <p className="text-gray-600">No players on this team.</p>
                            ) : (
                                playersByTeam[teamId].map((player) => (
                                    <div
                                        key={player.id}
                                        className="flex items-center justify-between rounded-lg border p-4"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {player.first_name} {player.last_name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Jersey #{player.jersey_number ?? "-"}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateAttendance(player.id, "pending")}
                                                className={`rounded-lg px-4 py-2 text-sm ${
                                                    attendanceByPlayer[player.id] === "pending"
                                                        ? "bg-black text-white"
                                                        : "border"
                                                }`}
                                            >
                                                Pending
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => updateAttendance(player.id, "yes")}
                                                className={`rounded-lg px-4 py-2 text-sm ${
                                                    attendanceByPlayer[player.id] === "yes"
                                                        ? "bg-black text-white"
                                                        : "border"
                                                }`}
                                            >
                                                Yes
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => updateAttendance(player.id, "no")}
                                                className={`rounded-lg px-4 py-2 text-sm ${
                                                    attendanceByPlayer[player.id] === "no"
                                                        ? "bg-black text-white"
                                                        : "border"
                                                }`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={saveAttendance}
                    disabled={saving}
                    className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save Attendance"}
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