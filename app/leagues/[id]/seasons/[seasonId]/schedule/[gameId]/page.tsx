import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Game = {
    id: number;
    league_id: number;
    season_id: number;
    home_team_id: number | null;
    away_team_id: number | null;
    game_date: string | null;
    game_time: string | null;
    location: string | null;
    status: string | null;
    home_score: number | null;
    away_score: number | null;
    result_type: string | null;
    game_type: string | null;
    game_number: number | null;
};

type Team = {
    id: number;
    team_name: string;
};

type AttendanceRow = {
    team_id: number;
    attendance_status: string;
};

type LineupRow = {
    team_id: number;
    player_id: number;
    lineup_slot: string | null;
};

type Player = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    jersey_number: number | null;
};

function playerDisplay(player: Player | undefined) {
    if (!player) return "Not set";
    const fullName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
    if (player.jersey_number !== null && player.jersey_number !== undefined) {
        return `${fullName} #${player.jersey_number}`;
    }
    return fullName || "Not set";
}

function GameStatusBadge({ status }: { status: string | null }) {
    const s = (status ?? "scheduled").toLowerCase();
    if (s === "completed") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Completed
            </span>
        );
    }
    if (s === "scheduled") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                Scheduled
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {status}
        </span>
    );
}

export default async function GameSummaryPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; gameId: string }>;
}) {
    const { id, seasonId, gameId } = await params;

    const { data: game, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", Number(gameId))
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .single();

    if (gameError || !game) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="mx-auto max-w-6xl px-6 py-10">
                    <h1 className="text-3xl font-bold">Game not found</h1>
                    <p className="mt-2 text-gray-500">We could not load that game.</p>
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/schedule`}
                        className="mt-4 inline-block text-sm underline"
                    >
                        Back to Schedule
                    </Link>
                </main>
            </div>
        );
    }

    const [leagueResult, seasonResult] = await Promise.all([
        supabase.from("leagues").select("id, league_name").eq("id", Number(id)).single(),
        supabase.from("seasons").select("id, season_name").eq("id", Number(seasonId)).eq("league_id", Number(id)).single(),
    ]);

    const league = leagueResult.data;
    const season = seasonResult.data;

    const teamIds = [game.home_team_id, game.away_team_id].filter(
        (value): value is number => value !== null
    );

    const { data: teamsData } = await supabase
        .from("teams")
        .select("id, team_name")
        .in("id", teamIds.length > 0 ? teamIds : [-1]);

    const teams = (teamsData ?? []) as Team[];

    const teamNameById = new Map<number, string>(
        teams.map((team) => [team.id, team.team_name])
    );

    const { data: attendanceData } = await supabase
        .from("game_attendance")
        .select("team_id, attendance_status")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .eq("game_id", Number(gameId));

    const attendance = (attendanceData ?? []) as AttendanceRow[];

    const homeAttendanceCount = attendance.filter(
        (row) => row.team_id === game.home_team_id && row.attendance_status === "in"
    ).length;

    const awayAttendanceCount = attendance.filter(
        (row) => row.team_id === game.away_team_id && row.attendance_status === "in"
    ).length;

    const { data: lineupData } = await supabase
        .from("game_lineups")
        .select("team_id, player_id, lineup_slot")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .eq("game_id", Number(gameId));

    const lineups = (lineupData ?? []) as LineupRow[];

    const playerIds = Array.from(new Set(lineups.map((row) => row.player_id)));

    const { data: playersData } = await supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number")
        .in("id", playerIds.length > 0 ? playerIds : [-1]);

    const players = (playersData ?? []) as Player[];

    const playerById = new Map<number, Player>(
        players.map((player) => [player.id, player])
    );

    const lineupByTeamAndSlot = new Map<string, Player>();

    for (const row of lineups) {
        if (!row.lineup_slot) continue;
        const player = playerById.get(row.player_id);
        if (!player) continue;
        lineupByTeamAndSlot.set(`${row.team_id}|${row.lineup_slot}`, player);
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "TBD";
        const date = new Date(`${dateString}T00:00:00`);
        return date.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
        });
    };

    const formatTime = (timeString: string | null) => {
        if (!timeString) return "TBD";
        const [hours, minutes] = timeString.split(":");
        const date = new Date();
        date.setHours(Number(hours), Number(minutes), 0, 0);
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const homeTeamName =
        game.home_team_id !== null
            ? teamNameById.get(game.home_team_id) || "Unknown Team"
            : "Home Team Not Set";

    const awayTeamName =
        game.away_team_id !== null
            ? teamNameById.get(game.away_team_id) || "Unknown Team"
            : "Away Team Not Set";

    const getLineupPlayer = (teamId: number | null, slot: string) => {
        if (teamId === null) return undefined;
        return lineupByTeamAndSlot.get(`${teamId}|${slot}`);
    };

    const hasScore = game.home_score !== null || game.away_score !== null;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="mx-auto max-w-6xl px-6 py-8">

                {/* Breadcrumb */}
                <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-400">
                    <Link href="/dashboard" className="transition-colors hover:text-gray-700">
                        Dashboard
                    </Link>
                    <span>/</span>
                    <Link href={`/leagues/${id}`} className="transition-colors hover:text-gray-700">
                        {league?.league_name ?? "League"}
                    </Link>
                    <span>/</span>
                    <Link href={`/leagues/${id}/seasons/${seasonId}`} className="transition-colors hover:text-gray-700">
                        {season?.season_name ?? "Season"}
                    </Link>
                    <span>/</span>
                    <Link href={`/leagues/${id}/seasons/${seasonId}/schedule`} className="transition-colors hover:text-gray-700">
                        Schedule
                    </Link>
                    <span>/</span>
                    <span className="font-medium text-gray-700">
                        Game {game.game_number ?? game.id}
                    </span>
                </nav>

                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                {game.game_type === "playoff" ? "Playoff" : "Regular Season"} · Game {game.game_number ?? game.id}
                            </p>
                            <GameStatusBadge status={game.status} />
                        </div>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                            {homeTeamName} vs {awayTeamName}
                        </h1>
                    </div>
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/schedule`}
                        className="shrink-0 rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                    >
                        Back to Schedule
                    </Link>
                </div>

                {/* Info strip */}
                <div className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
                    <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
                        <div className="bg-white px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                                {formatDate(game.game_date)}
                            </p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Time</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                                {formatTime(game.game_time)}
                            </p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Location</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                                {game.location || "TBD"}
                            </p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Result Type</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                                {game.result_type || "Not set"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Score hero (only when score exists) */}
                {hasScore && (
                    <div className="mb-8 rounded-2xl bg-black p-6 text-white shadow-md">
                        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
                            {game.status === "completed" ? "Final Score" : "Current Score"}
                        </p>
                        <div className="flex items-center justify-center gap-8">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-400">{homeTeamName}</p>
                                <p className="mt-1 text-5xl font-bold">{game.home_score ?? 0}</p>
                            </div>
                            <p className="text-3xl font-light text-gray-600">—</p>
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-400">{awayTeamName}</p>
                                <p className="mt-1 text-5xl font-bold">{game.away_score ?? 0}</p>
                            </div>
                        </div>
                        {game.result_type && game.result_type !== "regulation" && (
                            <p className="mt-4 text-center text-xs uppercase tracking-widest text-gray-500">
                                {game.result_type}
                            </p>
                        )}
                    </div>
                )}

                {/* Team panels */}
                <div className="mb-8 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900">{homeTeamName}</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Checked in: {homeAttendanceCount}
                            {!hasScore && (
                                <span className="ml-3 text-gray-400">
                                    Score: {game.home_score ?? "—"}
                                </span>
                            )}
                        </p>

                        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Lineup Preview
                            </p>
                            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                                <p>
                                    Line 1:{" "}
                                    {playerDisplay(getLineupPlayer(game.home_team_id, "F1-LW"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.home_team_id, "F1-C"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.home_team_id, "F1-RW"))}
                                </p>
                                <p>
                                    Pair 1:{" "}
                                    {playerDisplay(getLineupPlayer(game.home_team_id, "D1-LD"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.home_team_id, "D1-RD"))}
                                </p>
                                <p>
                                    Goalie: {playerDisplay(getLineupPlayer(game.home_team_id, "G1"))}
                                </p>
                            </div>
                            <Link
                                href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineup-view`}
                                className="mt-3 inline-block text-sm font-medium text-gray-700 hover:underline"
                            >
                                View Full Lineup →
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900">{awayTeamName}</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Checked in: {awayAttendanceCount}
                            {!hasScore && (
                                <span className="ml-3 text-gray-400">
                                    Score: {game.away_score ?? "—"}
                                </span>
                            )}
                        </p>

                        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Lineup Preview
                            </p>
                            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                                <p>
                                    Line 1:{" "}
                                    {playerDisplay(getLineupPlayer(game.away_team_id, "F1-LW"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.away_team_id, "F1-C"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.away_team_id, "F1-RW"))}
                                </p>
                                <p>
                                    Pair 1:{" "}
                                    {playerDisplay(getLineupPlayer(game.away_team_id, "D1-LD"))} /{" "}
                                    {playerDisplay(getLineupPlayer(game.away_team_id, "D1-RD"))}
                                </p>
                                <p>
                                    Goalie: {playerDisplay(getLineupPlayer(game.away_team_id, "G1"))}
                                </p>
                            </div>
                            <Link
                                href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineup-view`}
                                className="mt-3 inline-block text-sm font-medium text-gray-700 hover:underline"
                            >
                                View Full Lineup →
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Action grid */}
                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Game Actions
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/edit`}
                            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                                Edit Details
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Set teams, date, time, and location.
                            </p>
                        </Link>

                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/attendance`}
                            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                                Attendance
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Set player check-in and check-out status.
                            </p>
                        </Link>

                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineups`}
                            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                                Edit Lineups
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Place available players into lineup slots.
                            </p>
                        </Link>

                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/score`}
                            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                                Set Score
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Enter the final score and game result.
                            </p>
                        </Link>

                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/stats`}
                            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                                Enter Stats
                            </h2>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Record goals, assists, shots, and goalie stats.
                            </p>
                        </Link>
                    </div>
                </div>

            </main>
        </div>
    );
}
