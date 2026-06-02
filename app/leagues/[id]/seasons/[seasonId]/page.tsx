import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function getStatusBadge(status: "In Progress" | "Completed") {
    if (status === "Completed") {
        return (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Completed
            </span>
        );
    }

    return (
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
            In Progress
        </span>
    );
}

function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default async function SeasonDetailPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = await params;

    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", Number(id))
        .single();

    const { data: season } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", Number(seasonId))
        .eq("league_id", Number(id))
        .single();

    const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: teamLeaders } = await supabase
        .from("team_leaders")
        .select("id, role")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: players } = await supabase
        .from("players")
        .select("id, amount_due, amount_paid, team_id, payment_exemption_percent")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: draftPlayers } = await supabase
        .from("draft_players")
        .select("id, drafted_team_id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: games } = await supabase
        .from("games")
        .select("status")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: draftPicks } = await supabase
        .from("draft_picks")
        .select("id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: draftOrder } = await supabase
        .from("draft_order")
        .select("id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    if (!league || !season) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">Season not found</h1>
                <p className="mt-2 text-gray-600">We could not load that season.</p>
            </main>
        );
    }

    const isDraftLeague = season.roster_setup_type === "draft";

    const teamCount = teams?.length || 0;
    const rosteredPlayers = players?.length || 0;
    const poolPlayers = draftPlayers?.length || 0;
    const draftedPlayers =
        draftPlayers?.filter((p) => p.drafted_team_id !== null).length || 0;
    const picksMade = draftPicks?.length || 0;
    const draftOrderSet = (draftOrder?.length || 0) > 0;

    const captainsAssignedCount =
        teamLeaders?.filter((leader) => leader.role === "C").length || 0;

    const captainsAssigned =
        teamCount > 0 && captainsAssignedCount === teamCount;

    const totalPlayers = isDraftLeague ? draftedPlayers : rosteredPlayers;

    const suggestedPlayerFee = Number(season.suggested_player_fee ?? 0);
    const playerCount = players?.length || 0;

    const totalLeagueCost = roundMoney(suggestedPlayerFee * playerCount);

    const weightedPlayerCount =
        players?.reduce((sum, player) => {
            const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
            return sum + (1 - exemptionPercent / 100);
        }, 0) || 0;

    const redistributedBaseFee =
        suggestedPlayerFee > 0 && weightedPlayerCount > 0
            ? roundMoney(totalLeagueCost / weightedPlayerCount)
            : suggestedPlayerFee;

    const calculatedTotalDue =
        players?.reduce((sum, player) => {
            const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
            const playerDue = roundMoney(
                redistributedBaseFee * (1 - exemptionPercent / 100)
            );

            return sum + playerDue;
        }, 0) || 0;

    const fallbackTotalDue =
        players?.reduce((sum, p) => sum + Number(p.amount_due ?? 0), 0) || 0;

    const totalDue = roundMoney(
        suggestedPlayerFee > 0 ? calculatedTotalDue : fallbackTotalDue
    );

    const totalPaid = roundMoney(
        players?.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0) || 0
    );

    const outstanding = roundMoney(totalDue - totalPaid);

    const completedGames =
        games?.filter((g) => g.status === "completed").length || 0;
    const gameCount = games?.length || 0;

    const financeSaved = suggestedPlayerFee > 0;
    const exemptionsSet = Boolean(season.exemptions_completed_at);
    const anyPaymentsEntered =
        players?.some((p) => Number(p.amount_paid ?? 0) > 0) || false;

    const allPlayersPaid =
        totalPlayers > 0 && outstanding <= 0 && totalDue > 0;

    const financeStatus = financeSaved ? "Completed" : "In Progress";
    const exemptionsStatus = exemptionsSet ? "Completed" : "In Progress";
    const paymentsStatus = allPlayersPaid
        ? "Completed"
        : anyPaymentsEntered
          ? "In Progress"
          : "In Progress";
    const scheduleStatus = gameCount > 0 ? "Completed" : "In Progress";

    const draftStatus =
        isDraftLeague &&
        teamCount > 0 &&
        poolPlayers > 0 &&
        captainsAssigned &&
        draftOrderSet
            ? "Completed"
            : "In Progress";

    const teamsStatus =
        !isDraftLeague && teamCount > 0 && rosteredPlayers > 0
            ? "Completed"
            : "In Progress";

    let nextStepTitle = "Complete finance setup";
    let nextStepDescription =
        "Estimate league pricing and projected player fees before building the season.";
    let nextStepHref = `/leagues/${id}/seasons/${seasonId}/finance`;

    if (financeSaved && isDraftLeague && draftStatus !== "Completed") {
        nextStepTitle = "Complete the draft";
        nextStepDescription =
            "Finish player pool, teams, captains, draft order, and draft board.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/draft`;
    } else if (financeSaved && !isDraftLeague && teamsStatus !== "Completed") {
        nextStepTitle = "Build teams and rosters";
        nextStepDescription =
            "Add players to teams before applying exemptions and generating the schedule.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/teams`;
    } else if (financeSaved && !exemptionsSet) {
        nextStepTitle = "Set payment exemptions";
        nextStepDescription =
            "Apply captain, alternate, goalie, or commissioner exemptions before confirming player balances.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/payments/exemptions`;
    } else if (financeSaved && exemptionsSet && scheduleStatus !== "Completed") {
        nextStepTitle = "Generate the schedule";
        nextStepDescription =
            "Create games and begin setting matchups, dates, times, and locations.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/schedule`;
    } else if (financeSaved && exemptionsSet && !allPlayersPaid) {
        nextStepTitle = "Complete payment collection";
        nextStepDescription =
            "Track player payments, balances, and collection notes as money comes in.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/payments`;
    }

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{season.season_name}</h1>
                    <p className="mt-2 text-gray-600">
                        {league.league_name} • {league.sport}
                    </p>
                    <p className="mt-3 text-sm text-gray-500">
                        Recommended workflow:{" "}
                        {isDraftLeague
                            ? "Finance → Draft Setup → Exemptions → Schedule → Payments → Stats → Standings"
                            : "Finance → Teams → Exemptions → Schedule → Payments → Stats → Standings"}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/edit`}
                        className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                    >
                        Edit Season
                    </Link>

                    <Link
                        href={`/leagues/${id}/seasons`}
                        className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                    >
                        Back to Seasons
                    </Link>
                </div>
            </div>

            <Link
                href={nextStepHref}
                className="mb-8 block rounded-xl border bg-black p-6 text-white shadow-sm hover:bg-gray-900"
            >
                <p className="text-sm font-medium text-gray-300">
                    Next Recommended Step
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{nextStepTitle}</h2>
                <p className="mt-2 text-sm text-gray-300">{nextStepDescription}</p>
            </Link>

            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">
                        {isDraftLeague ? "Drafted Players" : "Rostered Players"}
                    </p>
                    <p className="mt-2 text-3xl font-bold">{totalPlayers}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Collected</p>
                    <p className="mt-2 text-3xl font-bold">
                        ${formatCurrency(totalPaid)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Outstanding</p>
                    <p className="mt-2 text-3xl font-bold">
                        ${formatCurrency(outstanding)}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Games Completed</p>
                    <p className="mt-2 text-3xl font-bold">{completedGames}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/finance`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">Finance</h2>
                        {getStatusBadge(financeStatus)}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure league costs and projected player fees.
                    </p>
                </Link>

                {isDraftLeague ? (
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/draft`}
                        className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-xl font-semibold">Draft</h2>
                            {getStatusBadge(draftStatus)}
                        </div>

                        <p className="mt-2 text-sm text-gray-600">
                            Configure captains, draft order, player pool, and selections.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <p>Teams: {teamCount}</p>
                            <p>Pool: {poolPlayers}</p>
                            <p>Captains: {captainsAssignedCount} / {teamCount}</p>
                            <p>Order: {draftOrderSet ? "Set" : "Needed"}</p>
                            <p>Picks: {picksMade}</p>
                            <p>Drafted: {draftedPlayers}</p>
                        </div>
                    </Link>
                ) : (
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/teams`}
                        className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-xl font-semibold">Teams</h2>
                            {getStatusBadge(teamsStatus)}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            Create teams and build full rosters.
                        </p>
                    </Link>
                )}

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/payments/exemptions`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">Exemptions</h2>
                        {getStatusBadge(exemptionsStatus)}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Apply player exemptions and rebalance final season fees.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/schedule`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">Schedule</h2>
                        {getStatusBadge(scheduleStatus)}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Generate games, attendance, lineups, and results.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/payments`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">Payments</h2>
                        {getStatusBadge(paymentsStatus)}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Track balances, collected payments, and payment notes.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/stats`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Stats</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        View player leaders and season performance.
                    </p>
                </Link>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/standings`}
                    className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
                >
                    <h2 className="text-xl font-semibold">Standings</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Track records, goals, points, and rankings.
                    </p>
                </Link>
            </div>
        </main>
    );
}