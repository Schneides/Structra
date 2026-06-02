import DeleteSeasonPlayerButton from "./DeleteSeasonPlayerButton";
import BackButton from "./BackButton";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function formatSavePercentage(value: number | null) {
    if (value === null || value === undefined) return "-";
    return value.toFixed(3);
}

export default async function SeasonPlayerDetailPage({
    params,
}: {
    params: Promise<{
        id: string;
        seasonId: string;
        teamId: string;
        playerId: string;
    }>;
}) {
    const { id, seasonId, teamId, playerId } = await params;

    const { data: player, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .eq("team_id", teamId)
        .single();

    if (error || !player) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">Player not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not find that player.
                </p>
            </main>
        );
    }

    const { data: statsRows } = await supabase
        .from("game_player_stats")
        .select("goals, assists, points, shots, saves, save_percentage")
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .eq("player_id", playerId);

    const seasonStats = statsRows ?? [];

    const gamesPlayed = seasonStats.length;
    const goals = seasonStats.reduce(
        (sum, row) => sum + Number(row.goals ?? 0),
        0
    );
    const assists = seasonStats.reduce(
        (sum, row) => sum + Number(row.assists ?? 0),
        0
    );
    const points = seasonStats.reduce(
        (sum, row) => sum + Number(row.points ?? 0),
        0
    );
    const shots = seasonStats.reduce(
        (sum, row) => sum + Number(row.shots ?? 0),
        0
    );
    const saves = seasonStats.reduce(
        (sum, row) => sum + Number(row.saves ?? 0),
        0
    );

    const goalieRows = seasonStats.filter(
        (row) => row.save_percentage !== null || Number(row.saves ?? 0) > 0
    );

    const averageSavePercentage =
        goalieRows.length > 0
            ? goalieRows.reduce(
                  (sum, row) => sum + Number(row.save_percentage ?? 0),
                  0
              ) / goalieRows.length
            : null;

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {player.first_name} {player.last_name}
                </h1>

                <p className="mt-2 text-gray-600">
                    Email: {player.email || "Not set"}
                </p>
                <p className="text-gray-600">
                    Phone: {player.phone || "Not set"}
                </p>
                <p className="text-gray-600">
                    Jersey #: {player.jersey_number ?? "Not set"}
                </p>
                <p className="text-gray-600">
                    Position: {player.position || "Not set"}
                </p>
                <p className="text-gray-600">
                    Leadership Role:{" "}
                    {player.leadership_role === "captain"
                        ? "Captain"
                        : player.leadership_role === "alternate"
                        ? "Alternate Captain"
                        : "None"}
                </p>
                <p className="text-gray-600">
                    Amount Due: ${Number(player.amount_due ?? 0).toLocaleString()}
                </p>
                <p className="text-gray-600">
                    Amount Paid: ${Number(player.amount_paid ?? 0).toLocaleString()}
                </p>
                <p className="text-gray-600">
                    Payment Status: {player.payment_status || "Unpaid"}
                </p>
                <p className="text-gray-600">
                    Payment Notes: {player.payment_notes || "-"}
                </p>
            </div>

            <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold">Season Stats</h2>
                <p className="mt-2 text-gray-600">
                    Season totals for this player.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Games Played</p>
                        <p className="mt-2 text-2xl font-bold">{gamesPlayed}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Goals</p>
                        <p className="mt-2 text-2xl font-bold">{goals}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Assists</p>
                        <p className="mt-2 text-2xl font-bold">{assists}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Points</p>
                        <p className="mt-2 text-2xl font-bold">{points}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Shots</p>
                        <p className="mt-2 text-2xl font-bold">{shots}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Saves</p>
                        <p className="mt-2 text-2xl font-bold">{saves}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-gray-500">Save %</p>
                        <p className="mt-2 text-2xl font-bold">
                            {formatSavePercentage(averageSavePercentage)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-3">
                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster/${player.id}/edit`}
                    className="inline-block rounded-lg bg-black px-5 py-3 text-white"
                >
                    Edit Player
                </Link>

                <DeleteSeasonPlayerButton
                    leagueId={Number(id)}
                    seasonId={Number(seasonId)}
                    teamId={Number(teamId)}
                    playerId={Number(player.id)}
                />

                <BackButton />

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster`}
                    className="inline-block rounded-lg border px-5 py-3"
                >
                    View Players Roster
                </Link>
            </div>
        </main>
    );
}