import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// ── Status system ─────────────────────────────────────────────────────────────

type StepStatus = "completed" | "in_progress" | "not_started";

function StatusBadge({ status }: { status: StepStatus }) {
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Complete
            </span>
        );
    }
    if (status === "in_progress") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                In Progress
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Not Started
        </span>
    );
}

function StatCard({
    label,
    value,
    subtext,
    accent = false,
}: {
    label: string;
    value: string;
    subtext?: string;
    accent?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ? "text-red-600" : "text-gray-900"}`}>
                {value}
            </p>
            {subtext && <p className="mt-0.5 text-xs text-gray-400">{subtext}</p>}
        </div>
    );
}

function WorkflowCard({
    step,
    title,
    href,
    status,
    description,
    detail,
}: {
    step: number;
    title: string;
    href: string;
    status: StepStatus;
    description: string;
    detail?: string;
}) {
    return (
        <Link
            href={href}
            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                        {step}
                    </span>
                    <h2 className="text-base font-semibold text-gray-900 group-hover:underline">
                        {title}
                    </h2>
                </div>
                <StatusBadge status={status} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">{description}</p>
            {detail && (
                <p className="mt-3 border-t pt-3 text-xs font-medium text-gray-400">{detail}</p>
            )}
        </Link>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

    const { data: draftOrder } = await supabase
        .from("draft_order")
        .select("id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    if (!league || !season) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="mx-auto max-w-6xl px-6 py-10">
                    <h1 className="text-3xl font-bold">Season not found</h1>
                    <p className="mt-2 text-gray-600">We could not load that season.</p>
                    <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
                        Back to Dashboard
                    </Link>
                </main>
            </div>
        );
    }

    // ── Derived counts ────────────────────────────────────────────────────────

    const isDraftLeague = season.roster_setup_type === "draft";
    const teamCount = teams?.length ?? 0;
    const rosteredPlayers = players?.length ?? 0;
    const poolPlayers = draftPlayers?.length ?? 0;
    const draftedPlayers = draftPlayers?.filter((p) => p.drafted_team_id !== null).length ?? 0;
    const draftOrderSet = (draftOrder?.length ?? 0) > 0;
    const captainsAssignedCount = teamLeaders?.filter((l) => l.role === "C").length ?? 0;
    const captainsAssigned = teamCount > 0 && captainsAssignedCount === teamCount;
    const totalPlayers = isDraftLeague ? draftedPlayers : rosteredPlayers;

    const suggestedPlayerFee = Number(season.suggested_player_fee ?? 0);
    const playerCount = players?.length ?? 0;
    const totalLeagueCost = roundMoney(suggestedPlayerFee * playerCount);

    const weightedPlayerCount =
        players?.reduce((sum, p) => {
            const ex = Number(p.payment_exemption_percent ?? 0);
            return sum + (1 - ex / 100);
        }, 0) ?? 0;

    const redistributedBaseFee =
        suggestedPlayerFee > 0 && weightedPlayerCount > 0
            ? roundMoney(totalLeagueCost / weightedPlayerCount)
            : suggestedPlayerFee;

    const calculatedTotalDue =
        players?.reduce((sum, p) => {
            const ex = Number(p.payment_exemption_percent ?? 0);
            return sum + roundMoney(redistributedBaseFee * (1 - ex / 100));
        }, 0) ?? 0;

    const fallbackTotalDue =
        players?.reduce((sum, p) => sum + Number(p.amount_due ?? 0), 0) ?? 0;

    const totalDue = roundMoney(suggestedPlayerFee > 0 ? calculatedTotalDue : fallbackTotalDue);
    const totalPaid = roundMoney(
        players?.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0) ?? 0
    );
    const outstanding = roundMoney(totalDue - totalPaid);
    const completedGames = games?.filter((g) => g.status === "completed").length ?? 0;
    const gameCount = games?.length ?? 0;

    const financeSaved = suggestedPlayerFee > 0;
    const exemptionsSet = Boolean(season.exemptions_completed_at);
    const anyPaymentsEntered = players?.some((p) => Number(p.amount_paid ?? 0) > 0) ?? false;
    const allPlayersPaid = totalPlayers > 0 && outstanding <= 0 && totalDue > 0;

    // ── Status (3 states) ─────────────────────────────────────────────────────

    const financeStatus: StepStatus = financeSaved ? "completed" : "not_started";

    const draftStatus: StepStatus =
        teamCount > 0 && poolPlayers > 0 && captainsAssigned && draftOrderSet
            ? "completed"
            : teamCount > 0 || poolPlayers > 0
              ? "in_progress"
              : "not_started";

    const teamsStatus: StepStatus =
        teamCount > 0 && rosteredPlayers > 0
            ? "completed"
            : teamCount > 0
              ? "in_progress"
              : "not_started";

    const exemptionsStatus: StepStatus = exemptionsSet
        ? "completed"
        : financeSaved
          ? "in_progress"
          : "not_started";

    const scheduleStatus: StepStatus =
        completedGames > 0 && completedGames === gameCount
            ? "completed"
            : gameCount > 0
              ? "in_progress"
              : "not_started";

    const paymentsStatus: StepStatus = allPlayersPaid
        ? "completed"
        : anyPaymentsEntered
          ? "in_progress"
          : "not_started";

    const standingsStatus: StepStatus = completedGames > 0 ? "in_progress" : "not_started";

    // ── Next step ─────────────────────────────────────────────────────────────

    let nextStepTitle = "Set up season finance";
    let nextStepDescription =
        "Estimate league pricing and projected player fees before building the season.";
    let nextStepHref = `/leagues/${id}/seasons/${seasonId}/finance`;

    if (financeSaved && isDraftLeague && draftStatus !== "completed") {
        nextStepTitle = "Complete the draft setup";
        nextStepDescription =
            "Finish player pool, teams, captains, draft order, and draft board.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/draft`;
    } else if (financeSaved && !isDraftLeague && teamsStatus !== "completed") {
        nextStepTitle = "Build teams and rosters";
        nextStepDescription =
            "Add players to teams before applying exemptions and generating the schedule.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/teams`;
    } else if (financeSaved && !exemptionsSet) {
        nextStepTitle = "Set payment exemptions";
        nextStepDescription =
            "Apply captain, alternate, goalie, or commissioner exemptions before confirming player balances.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/payments/exemptions`;
    } else if (financeSaved && exemptionsSet && scheduleStatus === "not_started") {
        nextStepTitle = "Generate the schedule";
        nextStepDescription =
            "Create games and begin setting matchups, dates, times, and locations.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/schedule`;
    } else if (financeSaved && exemptionsSet && !allPlayersPaid) {
        nextStepTitle = "Complete payment collection";
        nextStepDescription =
            "Track player payments, balances, and collection notes as money comes in.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/payments`;
    } else if (allPlayersPaid) {
        nextStepTitle = "View season standings";
        nextStepDescription =
            "All payments collected. Review the current standings and final stats.";
        nextStepHref = `/leagues/${id}/seasons/${seasonId}/standings`;
    }

    // ── Render ────────────────────────────────────────────────────────────────

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
                        {league.league_name}
                    </Link>
                    <span>/</span>
                    <span className="font-medium text-gray-700">{season.season_name}</span>
                </nav>

                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                                {season.season_name}
                            </h1>
                            <span className="rounded-full border border-gray-200 bg-white px-3 py-0.5 text-xs font-medium text-gray-500 shadow-sm">
                                {isDraftLeague ? "Draft League" : "Manual Rosters"}
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            {league.league_name} · {league.sport}
                        </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/edit`}
                            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                        >
                            Edit
                        </Link>
                        <Link
                            href={`/leagues/${id}/seasons`}
                            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                        >
                            All Seasons
                        </Link>
                    </div>
                </div>

                {/* Next Step Banner */}
                <Link
                    href={nextStepHref}
                    className="mb-8 flex items-center justify-between gap-6 rounded-2xl bg-black px-6 py-5 shadow-md transition-colors hover:bg-gray-900"
                >
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                            Recommended Next Step
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-white">{nextStepTitle}</h2>
                        <p className="mt-1 text-sm text-gray-400">{nextStepDescription}</p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-lg text-white/60">
                        →
                    </div>
                </Link>

                {/* Stats row */}
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                        label={isDraftLeague ? "Drafted Players" : "Rostered Players"}
                        value={String(totalPlayers)}
                    />
                    <StatCard
                        label="Collected"
                        value={`$${formatCurrency(totalPaid)}`}
                    />
                    <StatCard
                        label="Outstanding"
                        value={`$${formatCurrency(outstanding)}`}
                        accent={outstanding > 0.01}
                    />
                    <StatCard
                        label="Games Done"
                        value={String(completedGames)}
                        subtext={gameCount > 0 ? `of ${gameCount} total` : "none scheduled yet"}
                    />
                </div>

                {/* Workflow grid */}
                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Season Workflow
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <WorkflowCard
                            step={1}
                            title="Finance"
                            href={`/leagues/${id}/seasons/${seasonId}/finance`}
                            status={financeStatus}
                            description="Configure league costs and projected player fees."
                            detail={financeSaved ? `$${formatCurrency(suggestedPlayerFee)} / player` : undefined}
                        />

                        {isDraftLeague ? (
                            <WorkflowCard
                                step={2}
                                title="Draft"
                                href={`/leagues/${id}/seasons/${seasonId}/draft`}
                                status={draftStatus}
                                description="Configure captains, draft order, player pool, and make picks."
                                detail={
                                    teamCount > 0
                                        ? `${teamCount} teams · ${captainsAssignedCount}/${teamCount} captains · ${draftedPlayers} drafted`
                                        : undefined
                                }
                            />
                        ) : (
                            <WorkflowCard
                                step={2}
                                title="Teams"
                                href={`/leagues/${id}/seasons/${seasonId}/teams`}
                                status={teamsStatus}
                                description="Create teams and build full rosters."
                                detail={
                                    teamCount > 0
                                        ? `${teamCount} teams · ${rosteredPlayers} players`
                                        : undefined
                                }
                            />
                        )}

                        <WorkflowCard
                            step={3}
                            title="Exemptions"
                            href={`/leagues/${id}/seasons/${seasonId}/payments/exemptions`}
                            status={exemptionsStatus}
                            description="Apply captain, goalie, and commissioner exemptions before confirming balances."
                        />

                        <WorkflowCard
                            step={4}
                            title="Schedule"
                            href={`/leagues/${id}/seasons/${seasonId}/schedule`}
                            status={scheduleStatus}
                            description="Generate games, manage attendance, lineups, and results."
                            detail={
                                gameCount > 0
                                    ? `${completedGames} of ${gameCount} games complete`
                                    : undefined
                            }
                        />

                        <WorkflowCard
                            step={5}
                            title="Payments"
                            href={`/leagues/${id}/seasons/${seasonId}/payments`}
                            status={paymentsStatus}
                            description="Track balances, collected payments, and payment notes."
                            detail={
                                totalDue > 0
                                    ? `$${formatCurrency(totalPaid)} of $${formatCurrency(totalDue)} collected`
                                    : undefined
                            }
                        />

                        <WorkflowCard
                            step={6}
                            title="Stats"
                            href={`/leagues/${id}/seasons/${seasonId}/stats`}
                            status={completedGames > 0 ? "in_progress" : "not_started"}
                            description="View player leaders and season performance data."
                        />

                        <WorkflowCard
                            step={7}
                            title="Standings"
                            href={`/leagues/${id}/seasons/${seasonId}/standings`}
                            status={standingsStatus}
                            description="Track records, goals, points, and team rankings."
                            detail={
                                completedGames > 0
                                    ? `Based on ${completedGames} completed game${completedGames !== 1 ? "s" : ""}`
                                    : undefined
                            }
                        />
                    </div>
                </div>

            </main>
        </div>
    );
}
