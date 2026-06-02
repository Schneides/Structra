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
};

type Team = {
    id: number;
    team_name: string;
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

function renderSlot(
    lineupByTeamAndSlot: Map<string, Player>,
    teamId: number | null,
    slot: string,
    label: string
) {
    const player =
        teamId !== null ? lineupByTeamAndSlot.get(`${teamId}|${slot}`) : undefined;

    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-sm font-medium">{playerDisplay(player)}</p>
        </div>
    );
}

function renderTeamLineup(
    teamId: number | null,
    teamName: string,
    lineupByTeamAndSlot: Map<string, Player>
) {
    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">{teamName}</h2>

            <div className="mt-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold">Forwards</h3>
                    <div className="mt-4 space-y-4">
                        {[1, 2, 3, 4].map((line) => (
                            <div key={`F${line}`}>
                                <p className="mb-2 text-sm font-medium text-gray-600">
                                    Line {line}
                                </p>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {renderSlot(lineupByTeamAndSlot, teamId, `F${line}-LW`, "LW")}
                                    {renderSlot(lineupByTeamAndSlot, teamId, `F${line}-C`, "C")}
                                    {renderSlot(lineupByTeamAndSlot, teamId, `F${line}-RW`, "RW")}
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
                                    {renderSlot(lineupByTeamAndSlot, teamId, `D${pair}-LD`, "LD")}
                                    {renderSlot(lineupByTeamAndSlot, teamId, `D${pair}-RD`, "RD")}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold">Goalie</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-1">
                        {renderSlot(lineupByTeamAndSlot, teamId, "G1", "Goalie")}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function GameLineupViewPage({
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
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">Game not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load that lineup.
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

    const homeTeamName =
        game.home_team_id !== null
            ? teamNameById.get(game.home_team_id) || "Home Team"
            : "Home Team";

    const awayTeamName =
        game.away_team_id !== null
            ? teamNameById.get(game.away_team_id) || "Away Team"
            : "Away Team";

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Full Lineup View</h1>
                    <p className="mt-2 text-gray-600">
                        Read-only lineup view for this game.
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule/${gameId}`}
                    className="rounded-lg border px-5 py-3"
                >
                    Back to Game
                </Link>
            </div>

            <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">
                    {homeTeamName} vs {awayTeamName}
                </p>
                <p className="mt-2 text-gray-600">Date: {game.game_date || "TBD"}</p>
                <p className="text-gray-600">Time: {game.game_time || "TBD"}</p>
                <p className="text-gray-600">Location: {game.location || "TBD"}</p>
            </div>

            <div className="space-y-8">
                {renderTeamLineup(game.home_team_id, homeTeamName, lineupByTeamAndSlot)}
                {renderTeamLineup(game.away_team_id, awayTeamName, lineupByTeamAndSlot)}
            </div>
        </main>
    );
}