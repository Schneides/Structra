import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default async function LeagueDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const { data: league, error } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", Number(id))
        .single();

    const { data: seasonsData } = await supabase
        .from("seasons")
        .select("*")
        .eq("league_id", Number(id))
        .order("id", { ascending: false });

    const { data: playersData } = await supabase
        .from("players")
        .select("id, season_id, amount_due, amount_paid")
        .eq("league_id", Number(id));

    const { data: teamsData } = await supabase
        .from("teams")
        .select("id, season_id")
        .eq("league_id", Number(id));

    const { data: gamesData } = await supabase
        .from("games")
        .select("id, season_id, status")
        .eq("league_id", Number(id));

    if (error || !league) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">League not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not find that league.
                </p>
            </main>
        );
    }

    const seasons = seasonsData ?? [];
    const players = playersData ?? [];
    const teams = teamsData ?? [];
    const games = gamesData ?? [];

    const totalDue = players.reduce(
        (sum, player) => sum + Number(player.amount_due ?? 0),
        0
    );

    const totalPaid = players.reduce(
        (sum, player) => sum + Number(player.amount_paid ?? 0),
        0
    );

    const outstanding = totalDue - totalPaid;

    const completedGames = games.filter(
        (game) => game.status === "completed"
    ).length;

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">{league.league_name}</h1>

                    <p className="mt-2 text-gray-600">{league.sport}</p>

                    <p className="mt-1 text-sm text-gray-500">
                        Manage seasons, players, payments, schedules, and league activity from one place.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${league.id}/edit`}
                        className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                    >
                        Edit League
                    </Link>

                    <Link
                        href={`/leagues/${league.id}/seasons`}
                        className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                    >
                        View Seasons
                    </Link>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Seasons</p>
                    <p className="mt-2 text-2xl font-bold">{seasons.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Total Players</p>
                    <p className="mt-2 text-2xl font-bold">{players.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Total Teams</p>
                    <p className="mt-2 text-2xl font-bold">{teams.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Games Completed</p>
                    <p className="mt-2 text-2xl font-bold">{completedGames}</p>
                </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Collected</p>
                    <p className="mt-2 text-2xl font-bold">
                        ${formatCurrency(totalPaid)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Outstanding</p>
                    <p className="mt-2 text-2xl font-bold">
                        ${formatCurrency(outstanding)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">League Balance Total</p>
                    <p className="mt-2 text-2xl font-bold">
                        ${formatCurrency(totalDue)}
                    </p>
                </div>
            </div>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold">Seasons</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Open a season to continue setup, run drafts, track payments, manage schedules, and view standings.
                        </p>
                    </div>

                    <Link
                        href={`/leagues/${league.id}/seasons/new`}
                        className="rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800"
                    >
                        Create Season
                    </Link>
                </div>

                {seasons.length === 0 ? (
                    <div className="rounded-lg border bg-gray-50 p-5">
                        <h3 className="font-semibold">No seasons yet</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Create your first season to begin setup.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {seasons.map((season) => {
                            const seasonPlayers = players.filter(
                                (player) => player.season_id === season.id
                            );

                            const seasonTeams = teams.filter(
                                (team) => team.season_id === season.id
                            );

                            const seasonGames = games.filter(
                                (game) => game.season_id === season.id
                            );

                            const seasonCompletedGames = seasonGames.filter(
                                (game) => game.status === "completed"
                            ).length;

                            const seasonPaid = seasonPlayers.reduce(
                                (sum, player) => sum + Number(player.amount_paid ?? 0),
                                0
                            );

                            const seasonDue = seasonPlayers.reduce(
                                (sum, player) => sum + Number(player.amount_due ?? 0),
                                0
                            );

                            return (
                                <Link
                                    key={season.id}
                                    href={`/leagues/${league.id}/seasons/${season.id}`}
                                    className="block rounded-lg border p-5 hover:bg-gray-50"
                                >
                                    <div className="mb-4 flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold">
                                                {season.season_name}
                                            </h3>

                                            <p className="mt-1 text-sm text-gray-600">
                                                Setup Type:{" "}
                                                {season.roster_setup_type === "draft"
                                                    ? "Draft"
                                                    : "Manual Rosters"}
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                            Open Season
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                                        <div>
                                            <p className="text-gray-500">Teams</p>
                                            <p className="font-semibold">{seasonTeams.length}</p>
                                        </div>

                                        <div>
                                            <p className="text-gray-500">Players</p>
                                            <p className="font-semibold">{seasonPlayers.length}</p>
                                        </div>

                                        <div>
                                            <p className="text-gray-500">Collected</p>
                                            <p className="font-semibold">
                                                ${formatCurrency(seasonPaid)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-gray-500">Outstanding</p>
                                            <p className="font-semibold">
                                                ${formatCurrency(seasonDue - seasonPaid)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-gray-500">Games</p>
                                            <p className="font-semibold">
                                                {seasonCompletedGames}/{seasonGames.length}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}