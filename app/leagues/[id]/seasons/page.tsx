import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function getStatusBadge(status: "Not Started" | "Ready") {
    if (status === "Ready") {
        return (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Ready
            </span>
        );
    }

    return (
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            Not Started
        </span>
    );
}

type PlayerRow = {
    season_id: number;
};

type GameRow = {
    season_id: number;
};

export default async function LeagueSeasonsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    const { data: seasons, error: seasonsError } = await supabase
        .from("seasons")
        .select("*")
        .eq("league_id", id)
        .order("id", { ascending: false });

    const { data: playersData } = await supabase
        .from("players")
        .select("season_id")
        .eq("league_id", id);

    const { data: gamesData } = await supabase
        .from("games")
        .select("season_id")
        .eq("league_id", id);

    if (leagueError || !league) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">League not found</h1>
                <p className="mt-2 text-gray-600">We could not load that league.</p>
            </main>
        );
    }

    const players = (playersData ?? []) as PlayerRow[];
    const games = (gamesData ?? []) as GameRow[];

    const playerCountBySeason = new Map<number, number>();
    for (const player of players) {
        const current = playerCountBySeason.get(player.season_id) ?? 0;
        playerCountBySeason.set(player.season_id, current + 1);
    }

    const gameCountBySeason = new Map<number, number>();
    for (const game of games) {
        const current = gameCountBySeason.get(game.season_id) ?? 0;
        gameCountBySeason.set(game.season_id, current + 1);
    }

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Seasons</h1>
                    <p className="mt-2 text-gray-600">
                        {league.league_name} • {league.sport}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${league.id}/seasons/new`}
                        className="inline-block rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Add Season
                    </Link>

                    <Link
                        href={`/leagues/${league.id}`}
                        className="inline-block rounded-lg border px-5 py-3"
                    >
                        Back to League
                    </Link>
                </div>
            </div>

            {seasonsError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
                    There was a problem loading seasons.
                </div>
            )}

            {!seasonsError && (!seasons || seasons.length === 0) && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No seasons yet</h2>
                    <p className="mt-2 text-gray-600">
                        Add the first season for this league.
                    </p>
                </div>
            )}

            {!seasonsError && seasons && seasons.length > 0 && (
                <div className="grid gap-4">
                    {seasons.map((season) => {
                        const playerCount = playerCountBySeason.get(season.id) ?? 0;
                        const gameCount = gameCountBySeason.get(season.id) ?? 0;
                        const financeStatus =
                            Number(season.suggested_player_fee ?? 0) > 0
                                ? "Ready"
                                : "Not Started";

                        return (
                            <Link
                                key={season.id}
                                href={`/leagues/${league.id}/seasons/${season.id}`}
                                className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold">
                                            {season.season_name}
                                        </h2>
                                        <p className="mt-2 text-gray-600">
                                            Teams: {season.num_teams ?? 0}
                                        </p>
                                        <p className="text-gray-600">
                                            Regular Games: {season.regular_season_games ?? 0}
                                        </p>
                                        <p className="text-gray-600">
                                            Playoff Games: {season.playoff_games ?? 0}
                                        </p>
                                    </div>

                                    <div className="shrink-0">
                                        {getStatusBadge(financeStatus)}
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Players</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {playerCount}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Games Created</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {gameCount}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Finance</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {financeStatus}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}