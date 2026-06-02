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

function FinanceBadge({ fee }: { fee: number | null | undefined }) {
    const done = Number(fee ?? 0) > 0;
    if (done) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Finance set
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Finance needed
        </span>
    );
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
            <div className="min-h-screen bg-gray-50">
                <main className="mx-auto max-w-6xl px-6 py-10">
                    <h1 className="text-3xl font-bold">League not found</h1>
                    <p className="mt-2 text-gray-500">We could not find that league.</p>
                    <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
                        Back to Dashboard
                    </Link>
                </main>
            </div>
        );
    }

    const seasons = seasonsData ?? [];
    const players = playersData ?? [];
    const teams = teamsData ?? [];
    const games = gamesData ?? [];

    const totalPaid = players.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0);
    const totalDue = players.reduce((sum, p) => sum + Number(p.amount_due ?? 0), 0);
    const outstanding = totalDue - totalPaid;
    const completedGames = games.filter((g) => g.status === "completed").length;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="mx-auto max-w-6xl px-6 py-8">

                {/* Breadcrumb */}
                <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-400">
                    <Link href="/dashboard" className="transition-colors hover:text-gray-700">
                        Dashboard
                    </Link>
                    <span>/</span>
                    <span className="font-medium text-gray-700">{league.league_name}</span>
                </nav>

                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                            {league.league_name}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            {league.sport ?? "Sport not set"}
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <Link
                            href={`/leagues/${league.id}/edit`}
                            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                        >
                            Edit League
                        </Link>
                        <Link
                            href={`/leagues/${league.id}/seasons/new`}
                            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
                        >
                            Add Season
                        </Link>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
                    <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-6">
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Seasons</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{seasons.length}</p>
                        </div>
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Players</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{players.length}</p>
                        </div>
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Teams</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{teams.length}</p>
                        </div>
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Games Done</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{completedGames}</p>
                        </div>
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Collected</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">${formatCurrency(totalPaid)}</p>
                        </div>
                        <div className="bg-white px-6 py-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Outstanding</p>
                            <p className={`mt-1 text-2xl font-bold ${outstanding > 0.01 ? "text-red-600" : "text-gray-900"}`}>
                                ${formatCurrency(outstanding)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Seasons section */}
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                            Seasons
                        </p>
                        <Link
                            href={`/leagues/${league.id}/seasons`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-900"
                        >
                            View all →
                        </Link>
                    </div>

                    {seasons.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
                            <p className="text-base font-semibold text-gray-900">No seasons yet</p>
                            <p className="mt-2 text-sm text-gray-500">
                                Create your first season to begin setup.
                            </p>
                            <Link
                                href={`/leagues/${league.id}/seasons/new`}
                                className="mt-6 inline-block rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                            >
                                Create Season
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                            <div className="divide-y">
                                {seasons.map((season) => {
                                    const seasonTeams = teams.filter((t) => t.season_id === season.id);
                                    const seasonPlayers = players.filter((p) => p.season_id === season.id);
                                    const seasonGames = games.filter((g) => g.season_id === season.id);
                                    const seasonCompleted = seasonGames.filter((g) => g.status === "completed").length;

                                    const setupLabel =
                                        season.roster_setup_type === "draft"
                                            ? "Draft"
                                            : season.roster_setup_type === "manual"
                                            ? "Manual"
                                            : null;

                                    return (
                                        <Link
                                            key={season.id}
                                            href={`/leagues/${league.id}/seasons/${season.id}`}
                                            className="flex flex-col gap-3 px-6 py-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {season.season_name}
                                                </span>
                                                {setupLabel && (
                                                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-400">
                                                        {setupLabel}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className="hidden text-xs text-gray-400 sm:inline">
                                                    {seasonTeams.length} teams
                                                </span>
                                                <span className="hidden text-xs text-gray-400 sm:inline">
                                                    {seasonPlayers.length} players
                                                </span>
                                                <span className="hidden text-xs text-gray-400 sm:inline">
                                                    {seasonCompleted}/{seasonGames.length} games
                                                </span>
                                                <FinanceBadge fee={season.suggested_player_fee} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
