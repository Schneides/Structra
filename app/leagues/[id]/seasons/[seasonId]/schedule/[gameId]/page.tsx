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
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">Game not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load that game.
                </p>
            </main>
        );
    }

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

        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
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

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500">
                        {game.game_type === "playoff" ? "Playoff" : "Regular Season"} • Game{" "}
                        {game.game_number ?? game.id}
                    </p>
                    <h1 className="mt-1 text-3xl font-bold">
                        {homeTeamName} vs {awayTeamName}
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Status: {game.status ?? "scheduled"}
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule`}
                    className="rounded-lg border px-5 py-3"
                >
                    Back to Schedule
                </Link>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="mt-2 text-xl font-semibold">
                        {formatDate(game.game_date)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="mt-2 text-xl font-semibold">
                        {formatTime(game.game_time)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="mt-2 text-xl font-semibold">
                        {game.location || "TBD"}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Result Type</p>
                    <p className="mt-2 text-xl font-semibold">
                        {game.result_type || "Not set"}
                    </p>
                </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">{homeTeamName}</h2>
                    <p className="mt-3 text-gray-600">
                        Checked In: {homeAttendanceCount}
                    </p>
                    <p className="mt-2 text-gray-600">
                        Score: {game.home_score ?? "-"}
                    </p>

                    <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                        <p className="font-medium">Lineup Preview</p>
                        <p className="mt-3 text-sm text-gray-600">
                            Line 1:{" "}
                            {playerDisplay(getLineupPlayer(game.home_team_id, "F1-LW"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.home_team_id, "F1-C"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.home_team_id, "F1-RW"))}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                            Pair 1:{" "}
                            {playerDisplay(getLineupPlayer(game.home_team_id, "D1-LD"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.home_team_id, "D1-RD"))}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                            Goalie: {playerDisplay(getLineupPlayer(game.home_team_id, "G1"))}
                        </p>
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineup-view`}
                            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
                        >
                            View Full Lineup
                        </Link>
                    </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">{awayTeamName}</h2>
                    <p className="mt-3 text-gray-600">
                        Checked In: {awayAttendanceCount}
                    </p>
                    <p className="mt-2 text-gray-600">
                        Score: {game.away_score ?? "-"}
                    </p>

                    <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                        <p className="font-medium">Lineup Preview</p>
                        <p className="mt-3 text-sm text-gray-600">
                            Line 1:{" "}
                            {playerDisplay(getLineupPlayer(game.away_team_id, "F1-LW"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.away_team_id, "F1-C"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.away_team_id, "F1-RW"))}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                            Pair 1:{" "}
                            {playerDisplay(getLineupPlayer(game.away_team_id, "D1-LD"))} /{" "}
                            {playerDisplay(getLineupPlayer(game.away_team_id, "D1-RD"))}
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                            Goalie: {playerDisplay(getLineupPlayer(game.away_team_id, "G1"))}
                        </p>
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineup-view`}
                            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
                        >
                            View Full Lineup
                        </Link>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/edit`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Edit Game Details</h2>
                    <p className="mt-2 text-gray-600">
                        Set teams, date, time, and location.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/attendance`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Attendance</h2>
                    <p className="mt-2 text-gray-600">
                        Set player check-in and check-out status.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/lineups`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Edit Lineups</h2>
                    <p className="mt-2 text-gray-600">
                        Place available players into lineup slots.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/score`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Set Score</h2>
                    <p className="mt-2 text-gray-600">
                        Enter the final score and game result.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}/stats`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Enter Stats</h2>
                    <p className="mt-2 text-gray-600">
                        Record goals, assists, shots, and goalie stats.
                    </p>
                </Link>
            </div>
        </main>
    );
}