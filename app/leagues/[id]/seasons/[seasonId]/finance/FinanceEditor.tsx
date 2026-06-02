"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FinanceEditorProps = {
    parentLeagueId: number;
    seasonId: number;
    leagueName: string;
    regularGames: number;
    numTeams: number;
    expectedTotalPlayers: number;
    initialIceCostPerGame: number;
    initialReservePercent: number;
    initialRefModel: string;
    initialRefCostPerGame: number;
    initialRefsPerGame: number;
    initialExpenseMode: string;
    initialExpenseAmount: number;
    initialSeasonLengthMonths: number;
    initialOneTimeAdminCost: number;
    // Playoff structure
    playoffTeams: number;
    playoffGamesPerRoundForCosting: number;
    // Saved model choices
    initialFinancePaymentModel: string;
    initialPlayoffCostAllocation: string;
    initialPlayoffCostingModel: string;
    initialPlayoffPaymentModel: string;
};

type SeasonPlayer = {
    id: number;
    amount_paid: number | null;
    payment_exemption_percent: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roundMoney = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

const roundUpDollar = (value: number) => Math.ceil(value);

const formatInputNumber = (value: number) =>
    Number.isNaN(value) ? 0 : value;

/**
 * Derive playoff rounds from the number of playoff teams.
 * Single elimination bracket: rounds = log2(playoffTeams).
 * Returns 0 if playoffTeams is 0 or not a power of 2.
 */
function derivePlayoffRounds(playoffTeams: number): number {
    if (playoffTeams <= 1) return 0;
    const rounds = Math.log2(playoffTeams);
    // Accept non-powers-of-2 by rounding up (e.g. 6 teams ≈ 3 rounds)
    return Math.ceil(rounds);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinanceEditor({
    parentLeagueId,
    seasonId,
    leagueName,
    regularGames,
    numTeams,
    expectedTotalPlayers,
    initialIceCostPerGame,
    initialReservePercent,
    initialRefModel,
    initialRefCostPerGame,
    initialRefsPerGame,
    initialExpenseMode,
    initialExpenseAmount,
    initialSeasonLengthMonths,
    initialOneTimeAdminCost,
    playoffTeams,
    playoffGamesPerRoundForCosting,
    initialFinancePaymentModel,
    initialPlayoffCostAllocation,
    initialPlayoffCostingModel,
    initialPlayoffPaymentModel,
}: FinanceEditorProps) {
    const router = useRouter();

    // -- Cost inputs --
    const [iceCostPerGame, setIceCostPerGame] = useState(initialIceCostPerGame);
    const [reservePercent, setReservePercent] = useState(initialReservePercent);
    const [refModel, setRefModel] = useState(initialRefModel);
    const [refCostPerGame, setRefCostPerGame] = useState(initialRefCostPerGame);
    const [refsPerGame, setRefsPerGame] = useState(initialRefsPerGame);
    const [expenseMode, setExpenseMode] = useState(initialExpenseMode);
    const [expenseAmount, setExpenseAmount] = useState(initialExpenseAmount);
    const [seasonLengthMonths, setSeasonLengthMonths] = useState(initialSeasonLengthMonths);
    const [oneTimeAdminCost, setOneTimeAdminCost] = useState(initialOneTimeAdminCost);

    // -- Playoff billing model choices --
    const [financePaymentModel, setFinancePaymentModel] = useState(initialFinancePaymentModel);
    const [playoffCostAllocation, setPlayoffCostAllocation] = useState(initialPlayoffCostAllocation);
    const [playoffCostingModel, setPlayoffCostingModel] = useState(initialPlayoffCostingModel);
    const [playoffPaymentModel, setPlayoffPaymentModel] = useState(initialPlayoffPaymentModel);

    // -- Players --
    const [players, setPlayers] = useState<SeasonPlayer[]>([]);
    const [playersLoading, setPlayersLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function loadPlayers() {
            setPlayersLoading(true);
            const { data, error } = await supabase
                .from("players")
                .select("id, amount_paid, payment_exemption_percent")
                .eq("season_id", seasonId)
                .eq("league_id", parentLeagueId);

            setPlayers(error ? [] : ((data ?? []) as SeasonPlayer[]));
            setPlayersLoading(false);
        }
        loadPlayers();
    }, [seasonId, parentLeagueId]);

    // ---------------------------------------------------------------------------
    // Core math engine
    // ---------------------------------------------------------------------------

    const totals = useMemo(() => {
        // --- Player base ---
        const rosteredPlayers = players.length;
        const exemptionEquivalent = players.reduce(
            (sum, p) => sum + Number(p.payment_exemption_percent ?? 0) / 100,
            0
        );
        const effectivePayingPlayers =
            rosteredPlayers > 0
                ? Math.max(rosteredPlayers - exemptionEquivalent, 0)
                : expectedTotalPlayers;
        const totalPlayersForDisplay =
            rosteredPlayers > 0 ? rosteredPlayers : expectedTotalPlayers;

        // --- Playoff structure ---
        const playoffRounds = derivePlayoffRounds(playoffTeams);

        // Worst case: every series goes the maximum number of games
        const worstCasePlayoffGamesPerTeam =
            playoffRounds * playoffGamesPerRoundForCosting;

        // Estimated: assume average series length ~60% of max (realistic middle ground)
        const estimatedPlayoffGamesPerTeam =
            playoffRounds * Math.ceil(playoffGamesPerRoundForCosting * 0.6);

        // Which costing model did the commissioner choose?
        const playoffGamesForCosting =
            playoffCostingModel === "worst_case"
                ? worstCasePlayoffGamesPerTeam
                : estimatedPlayoffGamesPerTeam;

        // --- League game counts ---
        // Regular season: each team plays regularGames, each game involves 2 teams
        const regularSeasonLeagueGames =
            numTeams > 0 ? (numTeams * regularGames) / 2 : 0;

        // Playoff league games depend on allocation model:
        // - playoff_teams_only: only playoff teams generate games
        // - all_players: same game count but cost spread across everyone
        const playoffLeagueGames =
            playoffTeams > 0
                ? (playoffTeams * playoffGamesForCosting) / 2
                : 0;

        const totalLeagueGames = regularSeasonLeagueGames + playoffLeagueGames;

        // --- Expenses ---
        const recurringExpenseTotal =
            expenseMode === "monthly"
                ? expenseAmount * seasonLengthMonths
                : expenseAmount;
        const overheadTotal =
            expenseMode === "monthly"
                ? recurringExpenseTotal + oneTimeAdminCost
                : recurringExpenseTotal;

        // --- Regular season costs ---
        const regularIceTotal = regularSeasonLeagueGames * iceCostPerGame;
        // Overhead is attributed proportionally to regular vs playoff games
        const regularOverheadShare =
            totalLeagueGames > 0
                ? regularSeasonLeagueGames / totalLeagueGames
                : 1;
        const regularOverhead = overheadTotal * regularOverheadShare;
        const regularBaseDirectCost = regularIceTotal + regularOverhead;

        // --- Playoff costs ---
        const playoffIceTotal = playoffLeagueGames * iceCostPerGame;
        const playoffOverheadShare =
            totalLeagueGames > 0
                ? playoffLeagueGames / totalLeagueGames
                : 0;
        const playoffOverhead = overheadTotal * playoffOverheadShare;
        const playoffBaseDirectCost = playoffIceTotal + playoffOverhead;

        // --- Refs ---
        const regularRefAppearances = refsPerGame * regularSeasonLeagueGames;
        const playoffRefAppearances = refsPerGame * playoffLeagueGames;
        const totalRefAppearances = regularRefAppearances + playoffRefAppearances;

        const bufferMultiplier = 1 + reservePercent / 100;

        // Helper: solve for cost given a direct cost base, ref appearances, and player-games
        function solveFinancials(
            baseDirectCost: number,
            refAppearances: number,
            playerGames: number
        ) {
            if (playerGames <= 0 || numTeams <= 0) {
                return {
                    playerCostPerGame: 0,
                    refAppearanceValue: 0,
                    refTotalCost: 0,
                    directCostIncludingRefs: baseDirectCost,
                    reserveAmount: baseDirectCost * (reservePercent / 100),
                    totalCost: baseDirectCost * bufferMultiplier,
                };
            }

            if (refModel === "internal") {
                const denominator =
                    playerGames - refAppearances * bufferMultiplier;
                if (denominator <= 0) {
                    return {
                        playerCostPerGame: 0,
                        refAppearanceValue: 0,
                        refTotalCost: 0,
                        directCostIncludingRefs: baseDirectCost,
                        reserveAmount: 0,
                        totalCost: 0,
                    };
                }
                const playerCostPerGame =
                    (baseDirectCost * bufferMultiplier) / denominator;
                const refAppearanceValue = playerCostPerGame;
                const refTotalCost = refAppearances * refAppearanceValue;
                const directCostIncludingRefs = baseDirectCost + refTotalCost;
                const reserveAmount =
                    directCostIncludingRefs * (reservePercent / 100);
                const totalCost = directCostIncludingRefs + reserveAmount;
                return {
                    playerCostPerGame,
                    refAppearanceValue,
                    refTotalCost,
                    directCostIncludingRefs,
                    reserveAmount,
                    totalCost,
                };
            } else {
                const refTotalCost = refAppearances * refCostPerGame;
                const directCostIncludingRefs = baseDirectCost + refTotalCost;
                const reserveAmount =
                    directCostIncludingRefs * (reservePercent / 100);
                const totalCost = directCostIncludingRefs + reserveAmount;
                const playerCostPerGame = totalCost / playerGames;
                return {
                    playerCostPerGame,
                    refAppearanceValue: refCostPerGame,
                    refTotalCost,
                    directCostIncludingRefs,
                    reserveAmount,
                    totalCost,
                };
            }
        }

        // --- Regular season financials ---
        const regularPlayerGames = effectivePayingPlayers * regularGames;
        const reg = solveFinancials(
            regularBaseDirectCost,
            regularRefAppearances,
            regularPlayerGames
        );
        const regularSeasonPlayerFee = reg.playerCostPerGame * regularGames;

        // --- Playoff financials ---
        // Who pays for playoff costs?
        const playoffPayingPlayers =
            playoffCostAllocation === "playoff_teams_only"
                ? (effectivePayingPlayers / (numTeams || 1)) * (playoffTeams || 0)
                : effectivePayingPlayers;

        const playoffPlayerGames =
            playoffPayingPlayers * playoffGamesForCosting;

        const po = solveFinancials(
            playoffBaseDirectCost,
            playoffRefAppearances,
            playoffPlayerGames
        );
        const playoffPlayerFee = po.playerCostPerGame * playoffGamesForCosting;

        // --- Combined totals ---
        const totalSeasonCost = reg.totalCost + po.totalCost;

        // What the commissioner will actually bill depends on the payment model
        const isCombined = financePaymentModel === "regular_plus_playoff_actual";
        const combinedPlayerFee = regularSeasonPlayerFee + playoffPlayerFee;

        const suggestedPlayerFee = isCombined
            ? combinedPlayerFee
            : regularSeasonPlayerFee; // split model: show reg season fee as primary

        const suggestedTeamFee =
            numTeams > 0 ? totalSeasonCost / numTeams : 0;

        const billedPlayerFee = roundUpDollar(suggestedPlayerFee);
        const billedTeamFee = roundUpDollar(suggestedTeamFee);

        return {
            // Player base
            rosteredPlayers,
            totalPlayersForDisplay,
            exemptionEquivalent,
            effectivePayingPlayers,
            // Playoff structure
            playoffRounds,
            worstCasePlayoffGamesPerTeam,
            estimatedPlayoffGamesPerTeam,
            playoffGamesForCosting,
            playoffPayingPlayers,
            // Game counts
            regularSeasonLeagueGames,
            playoffLeagueGames,
            totalLeagueGames,
            // Refs
            regularRefAppearances,
            playoffRefAppearances,
            totalRefAppearances,
            // Regular season breakdown
            regularIceTotal,
            regularOverhead,
            regularBaseDirectCost,
            regularRefTotalCost: reg.refTotalCost,
            regularDirectCostIncludingRefs: reg.directCostIncludingRefs,
            regularReserveAmount: reg.reserveAmount,
            totalRegularSeasonCost: reg.totalCost,
            regularSeasonPlayerFee,
            regularPlayerCostPerGame: reg.playerCostPerGame,
            // Playoff breakdown
            playoffIceTotal,
            playoffOverhead,
            playoffBaseDirectCost,
            playoffRefTotalCost: po.refTotalCost,
            playoffDirectCostIncludingRefs: po.directCostIncludingRefs,
            playoffReserveAmount: po.reserveAmount,
            totalPlayoffCost: po.totalCost,
            playoffPlayerFee,
            playoffPlayerCostPerGame: po.playerCostPerGame,
            // Combined
            totalSeasonCost,
            suggestedPlayerFee,
            suggestedTeamFee,
            billedPlayerFee,
            billedTeamFee,
            combinedPlayerFee,
            isCombined,
        };
    }, [
        players,
        expectedTotalPlayers,
        numTeams,
        regularGames,
        playoffTeams,
        playoffGamesPerRoundForCosting,
        playoffCostingModel,
        playoffCostAllocation,
        financePaymentModel,
        refsPerGame,
        iceCostPerGame,
        reservePercent,
        refModel,
        refCostPerGame,
        expenseMode,
        expenseAmount,
        seasonLengthMonths,
        oneTimeAdminCost,
    ]);

    // ---------------------------------------------------------------------------
    // Formatters
    // ---------------------------------------------------------------------------

    const formatCurrency = (value: number) =>
        roundMoney(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const getPaymentStatus = (due: number, paid: number) => {
        if (paid <= 0) return "Unpaid";
        if (due > 0 && paid >= due) return "Paid";
        return "Partial";
    };

    // ---------------------------------------------------------------------------
    // Save
    // ---------------------------------------------------------------------------

    const handleSave = async () => {
        setSaving(true);

        const billedRegularFee = roundUpDollar(totals.regularSeasonPlayerFee);
        const billedPlayoffFee = roundUpDollar(totals.playoffPlayerFee);
        const billedCombinedFee = roundUpDollar(totals.combinedPlayerFee);
        const billedTeamFee = roundUpDollar(totals.suggestedTeamFee);

        // The fee we'll actually write to players depends on the payment model
        const feeForPlayers = totals.isCombined
            ? billedCombinedFee
            : billedRegularFee;

        const seasonPayload = {
            // Cost inputs
            ice_cost_per_game: roundMoney(iceCostPerGame),
            reserve_percent: reservePercent,
            ref_model: refModel,
            refs_per_game: refsPerGame,
            ref_cost_per_game: refModel === "external" ? roundMoney(refCostPerGame) : 0,
            ref_appearances: totals.totalRefAppearances,
            expense_mode: expenseMode,
            expense_amount: roundMoney(expenseAmount),
            season_length_months: expenseMode === "monthly" ? seasonLengthMonths : 1,
            one_time_admin_cost: expenseMode === "monthly" ? roundMoney(oneTimeAdminCost) : 0,
            per_player_variable_cost: 0,

            // Playoff model choices
            finance_payment_model: financePaymentModel,
            playoff_cost_allocation: playoffCostAllocation,
            playoff_costing_model: playoffCostingModel,
            playoff_payment_model: playoffPaymentModel,

            // Derived playoff structure
            playoff_rounds: totals.playoffRounds,
            playoff_worst_case_games: totals.worstCasePlayoffGamesPerTeam,
            estimated_playoff_games: totals.estimatedPlayoffGamesPerTeam,
            regular_season_total_games: totals.regularSeasonLeagueGames,

            // Fee outputs
            suggested_player_fee: feeForPlayers,
            suggested_team_fee: billedTeamFee,
            regular_season_player_fee: billedRegularFee,
            playoff_player_fee: billedPlayoffFee,
            total_estimated_player_fee: billedCombinedFee,
            total_regular_season_cost: roundMoney(totals.totalRegularSeasonCost),
            total_playoff_cost_estimate: roundMoney(totals.totalPlayoffCost),
            current_player_fee: feeForPlayers,
        };

        const { error: seasonError } = await supabase
            .from("seasons")
            .update(seasonPayload)
            .eq("id", seasonId);

        if (seasonError) {
            setSaving(false);
            alert("There was a problem saving season finance settings.");
            return;
        }

        // Recalculate every player's amount_due
        const { data: playersData, error: playersError } = await supabase
            .from("players")
            .select("id, amount_paid, payment_exemption_percent")
            .eq("season_id", seasonId)
            .eq("league_id", parentLeagueId);

        if (playersError) {
            setSaving(false);
            alert("Finance settings saved, but there was a problem loading players for recalculation.");
            return;
        }

        const latestPlayers = (playersData ?? []) as SeasonPlayer[];

        for (const player of latestPlayers) {
            const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
            const amountPaid = Number(player.amount_paid ?? 0);

            // In split model, players are only billed the regular season fee now.
            // Playoff fees are added later when their team qualifies.
            const adjustedDue = roundUpDollar(
                feeForPlayers * (1 - exemptionPercent / 100)
            );

            const paymentStatus = getPaymentStatus(adjustedDue, amountPaid);

            const { error: updateError } = await supabase
                .from("players")
                .update({ amount_due: adjustedDue, payment_status: paymentStatus })
                .eq("id", player.id)
                .eq("season_id", seasonId)
                .eq("league_id", parentLeagueId);

            if (updateError) {
                setSaving(false);
                alert("Finance saved, but there was a problem recalculating some player dues.");
                return;
            }
        }

        setPlayers(latestPlayers);
        setSaving(false);
        router.push(`/leagues/${parentLeagueId}/seasons/${seasonId}`);
    };

    // ---------------------------------------------------------------------------
    // UI helpers
    // ---------------------------------------------------------------------------

    const isSplitModel = financePaymentModel === "regular_season_only";

    return (
        <main className="mx-auto max-w-7xl px-6 py-10">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Season Finance</h1>
                    <p className="mt-2 text-gray-600">{leagueName}</p>
                    <p className="mt-1 text-sm text-gray-500">
                        Estimate season pricing before rosters or draft picks are finalized.
                        Final fees may change when real players, exemptions, or schedule
                        details are updated.
                    </p>
                </div>
                <Link
                    href={`/leagues/${parentLeagueId}/seasons/${seasonId}`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center"
                >
                    Back to Season
                </Link>
            </div>

            {/* Hero summary card */}
            <div className="mb-8 rounded-2xl border bg-black p-6 text-white shadow-sm">
                <div className="grid gap-6 md:grid-cols-4">
                    <div className="md:col-span-2">
                        <p className="text-sm text-gray-300">
                            {isSplitModel ? "Regular Season Player Fee" : "Estimated Player Fee"}
                        </p>
                        <p className="mt-2 text-5xl font-bold">
                            ${roundUpDollar(totals.isCombined
                                ? totals.combinedPlayerFee
                                : totals.regularSeasonPlayerFee
                            ).toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-300">
                            {isSplitModel
                                ? `+$${roundUpDollar(totals.playoffPlayerFee).toLocaleString()} playoff fee billed separately to qualifying teams.`
                                : `Exact calculated fee: $${formatCurrency(totals.combinedPlayerFee)}. Rounded up for billing protection.`}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-300">Estimated Team Fee</p>
                        <p className="mt-2 text-3xl font-bold">
                            ${totals.billedTeamFee.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-gray-300">
                            Exact: ${formatCurrency(totals.suggestedTeamFee)}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-300">Total Season Cost</p>
                        <p className="mt-2 text-3xl font-bold">
                            ${formatCurrency(totals.totalSeasonCost)}
                        </p>
                        <p className="mt-2 text-sm text-gray-300">
                            Includes refs, expenses, and reserve.
                        </p>
                    </div>
                </div>

                {/* Split model: show both fees clearly */}
                {isSplitModel && (
                    <div className="mt-6 grid gap-4 border-t border-gray-700 pt-6 md:grid-cols-2">
                        <div className="rounded-xl bg-white/10 p-4">
                            <p className="text-sm text-gray-300">Regular Season Fee</p>
                            <p className="mt-1 text-2xl font-bold">
                                ${roundUpDollar(totals.regularSeasonPlayerFee).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Billed to all players upfront.
                            </p>
                        </div>
                        <div className="rounded-xl bg-white/10 p-4">
                            <p className="text-sm text-gray-300">Playoff Fee (per qualifying player)</p>
                            <p className="mt-1 text-2xl font-bold">
                                ${roundUpDollar(totals.playoffPlayerFee).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                {playoffCostAllocation === "playoff_teams_only"
                                    ? "Billed only to players on teams that qualify."
                                    : "Shared across all players when playoffs begin."}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Estimate warning */}
            <div className="mb-8 rounded-xl border border-yellow-300 bg-yellow-50 p-5 text-sm text-yellow-900">
                <p className="font-semibold">This is a projected finance estimate.</p>
                <p className="mt-1">
                    This number is useful for recruiting and early planning. Final player
                    fees may change after rosters, draft results, player exemptions, referee
                    settings, expenses, or schedule details are finalized.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                {/* ---- Left column: inputs ---- */}
                <div className="space-y-6 lg:col-span-3">

                    {/* 1. League Structure */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-2xl font-semibold">1. League Structure</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                These values come from season setup and control the overall pricing base.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Number of Teams</label>
                                <input type="number" value={numTeams} disabled
                                    className="w-full rounded-lg border bg-gray-100 px-4 py-3" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">Expected Total Players</label>
                                <input type="number" value={expectedTotalPlayers} disabled
                                    className="w-full rounded-lg border bg-gray-100 px-4 py-3" />
                                <p className="mt-1 text-xs text-gray-500">Used before actual rosters exist.</p>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">Regular Season Games Per Team</label>
                                <input type="number" value={regularGames} disabled
                                    className="w-full rounded-lg border bg-gray-100 px-4 py-3" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">Teams in Playoffs</label>
                                <input type="number" value={playoffTeams} disabled
                                    className="w-full rounded-lg border bg-gray-100 px-4 py-3" />
                                <p className="mt-1 text-xs text-gray-500">
                                    {totals.playoffRounds > 0
                                        ? `${totals.playoffRounds} playoff round${totals.playoffRounds !== 1 ? "s" : ""} derived automatically.`
                                        : "Set in season setup."}
                                </p>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">Max Games Per Playoff Round</label>
                                <input type="number" value={playoffGamesPerRoundForCosting} disabled
                                    className="w-full rounded-lg border bg-gray-100 px-4 py-3" />
                                <p className="mt-1 text-xs text-gray-500">
                                    Worst case: {totals.worstCasePlayoffGamesPerTeam} playoff games per team.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2. Cost Inputs */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-2xl font-semibold">2. Cost Inputs</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Enter the major league costs the commissioner needs to recover.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Ice / Facility Cost Per Game</label>
                                <input type="number" value={iceCostPerGame}
                                    onChange={(e) => setIceCostPerGame(formatInputNumber(Number(e.target.value)))}
                                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Are your league expenses monthly or a total season cost?
                                </label>
                                <select value={expenseMode} onChange={(e) => setExpenseMode(e.target.value)}
                                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                    <option value="monthly">Monthly</option>
                                    <option value="season_total">Total For Season</option>
                                </select>
                            </div>
                            {expenseMode === "monthly" ? (
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">Monthly Expense Cost</label>
                                        <input type="number" value={expenseAmount}
                                            onChange={(e) => setExpenseAmount(formatInputNumber(Number(e.target.value)))}
                                            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Example: admin tools, league software, monthly rentals.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">Season Length In Months</label>
                                        <input type="number" value={seasonLengthMonths}
                                            onChange={(e) => setSeasonLengthMonths(formatInputNumber(Number(e.target.value)))}
                                            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">Other One-Time Season Expenses</label>
                                        <input type="number" value={oneTimeAdminCost}
                                            onChange={(e) => setOneTimeAdminCost(formatInputNumber(Number(e.target.value)))}
                                            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Only use this for costs outside the monthly expenses.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Total Season Expense Amount</label>
                                    <input type="number" value={expenseAmount}
                                        onChange={(e) => setExpenseAmount(formatInputNumber(Number(e.target.value)))}
                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Use this when the league has one total expense budget instead of monthly costs.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Referee Model */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-2xl font-semibold">3. Referee Model</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Choose how officials are paid or credited.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Referee Cost Method</label>
                                <select value={refModel} onChange={(e) => setRefModel(e.target.value)}
                                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                    <option value="external">External Refs</option>
                                    <option value="internal">Internal Refs</option>
                                </select>
                                <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                                    <p className="font-medium text-gray-800">
                                        {refModel === "internal" ? "Internal Refs" : "External Refs"}
                                    </p>
                                    <p className="mt-1">
                                        {refModel === "internal"
                                            ? "Use this when league players referee games they are not playing in. The system values each ref appearance based on the calculated player cost per game."
                                            : "Use this when you hire officials at a set price per ref per game. Total ref cost is calculated from refs per game, total games, and cost per ref."}
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Refs Per Game</label>
                                    <input type="number" value={refsPerGame}
                                        onChange={(e) => setRefsPerGame(formatInputNumber(Number(e.target.value)))}
                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                </div>
                                {refModel === "external" && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">Cost Per Ref Per Game</label>
                                        <input type="number" value={refCostPerGame}
                                            onChange={(e) => setRefCostPerGame(formatInputNumber(Number(e.target.value)))}
                                            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                    </div>
                                )}
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Reserve / Buffer Percent</label>
                                    <input type="number" value={reservePercent}
                                        onChange={(e) => setReservePercent(formatInputNumber(Number(e.target.value)))}
                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Playoff Billing Model — NEW SECTION */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-2xl font-semibold">4. Playoff Billing Model</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Choose how playoff costs are estimated and charged to players.
                            </p>
                        </div>
                        <div className="space-y-5">

                            {/* Finance payment model */}
                            <div>
                                <label className="mb-2 block text-sm font-medium">How do you want to charge players?</label>
                                <select value={financePaymentModel}
                                    onChange={(e) => setFinancePaymentModel(e.target.value)}
                                    className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                    <option value="regular_plus_playoff_actual">
                                        Combined — one fee covers regular season and playoffs
                                    </option>
                                    <option value="regular_season_only">
                                        Split — regular season fee now, playoff fee billed separately
                                    </option>
                                </select>
                                <div className="mt-3 rounded-lg bg-white p-4 text-sm text-gray-600 border">
                                    {financePaymentModel === "regular_plus_playoff_actual" ? (
                                        <>
                                            <p className="font-medium text-gray-800">Combined billing</p>
                                            <p className="mt-1">
                                                Every player pays one upfront fee that covers both regular season
                                                and their share of projected playoff costs. Simpler for players,
                                                no extra billing step at playoff time.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-medium text-gray-800">Split billing</p>
                                            <p className="mt-1">
                                                Players pay the regular season fee now. When playoffs begin,
                                                the system will bill the playoff fee only to players on
                                                qualifying teams. Fairer for teams that miss playoffs.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Playoff cost allocation */}
                            <div>
                                <label className="mb-2 block text-sm font-medium">Who pays for playoff costs?</label>
                                <select value={playoffCostAllocation}
                                    onChange={(e) => setPlayoffCostAllocation(e.target.value)}
                                    className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                    <option value="playoff_teams_only">
                                        Playoff teams only — only qualifying teams share playoff costs
                                    </option>
                                    <option value="all_players">
                                        All players — playoff costs spread across the whole league
                                    </option>
                                </select>
                                <p className="mt-2 text-xs text-gray-500">
                                    {playoffCostAllocation === "playoff_teams_only"
                                        ? `Only the ${playoffTeams} playoff teams bear the playoff ice and ref costs.`
                                        : "Playoff costs are divided equally across all players in the league."}
                                </p>
                            </div>

                            {/* Playoff costing model */}
                            <div>
                                <label className="mb-2 block text-sm font-medium">How should playoff costs be estimated?</label>
                                <select value={playoffCostingModel}
                                    onChange={(e) => setPlayoffCostingModel(e.target.value)}
                                    className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                    <option value="worst_case">
                                        Worst case — assume every series goes the maximum games
                                    </option>
                                    <option value="estimated">
                                        Estimated — assume average series length (~60% of max)
                                    </option>
                                </select>
                                <div className="mt-2 rounded-lg bg-white border p-3 text-xs text-gray-600">
                                    <span className="font-medium">
                                        {playoffCostingModel === "worst_case"
                                            ? `Worst case: ${totals.worstCasePlayoffGamesPerTeam} games per team `
                                            : `Estimated: ${totals.estimatedPlayoffGamesPerTeam} games per team `}
                                    </span>
                                    ({totals.playoffRounds} round{totals.playoffRounds !== 1 ? "s" : ""} × {" "}
                                    {playoffCostingModel === "worst_case"
                                        ? playoffGamesPerRoundForCosting
                                        : Math.ceil(playoffGamesPerRoundForCosting * 0.6)}{" "}
                                    games). We recommend worst case so the league is never short.
                                </div>
                            </div>

                            {/* Playoff payment model (only relevant in split billing) */}
                            {isSplitModel && (
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        When do qualifying teams pay their playoff fee?
                                    </label>
                                    <select value={playoffPaymentModel}
                                        onChange={(e) => setPlayoffPaymentModel(e.target.value)}
                                        className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-black">
                                        <option value="pay_as_you_advance">
                                            Pay as you advance — billed each round
                                        </option>
                                        <option value="upfront_at_qualification">
                                            Upfront at qualification — full playoff fee when team qualifies
                                        </option>
                                    </select>
                                    <p className="mt-2 text-xs text-gray-500">
                                        {playoffPaymentModel === "pay_as_you_advance"
                                            ? "Teams are billed per round as they advance. A team eliminated in round 1 only pays for round 1."
                                            : "Teams pay the full estimated playoff fee as soon as they qualify, regardless of how far they advance."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save button */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || playersLoading}
                        className="w-full rounded-lg bg-black px-6 py-4 text-white text-lg font-semibold disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Finance Settings"}
                    </button>
                </div>

                {/* ---- Right column: summary panels ---- */}
                <div className="space-y-6 lg:col-span-2">

                    {/* Pricing Summary */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-2xl font-semibold">Pricing Summary</h2>
                        <div className="space-y-4">
                            <div className="rounded-lg border bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">
                                    {isSplitModel ? "Regular Season Player Fee" : "Estimated Player Fee"}
                                </p>
                                <p className="mt-1 text-3xl font-bold">
                                    ${roundUpDollar(isSplitModel
                                        ? totals.regularSeasonPlayerFee
                                        : totals.combinedPlayerFee
                                    ).toLocaleString()}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Exact: ${formatCurrency(isSplitModel
                                        ? totals.regularSeasonPlayerFee
                                        : totals.combinedPlayerFee)}
                                </p>
                            </div>

                            {isSplitModel && (
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-sm text-gray-500">Playoff Fee (qualifying players)</p>
                                    <p className="mt-1 text-3xl font-bold">
                                        ${roundUpDollar(totals.playoffPlayerFee).toLocaleString()}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Exact: ${formatCurrency(totals.playoffPlayerFee)}
                                    </p>
                                </div>
                            )}

                            <div className="rounded-lg border bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">Player Cost Per Game (Reg Season)</p>
                                <p className="mt-1 text-xl font-semibold">
                                    ${formatCurrency(totals.regularPlayerCostPerGame)}
                                </p>
                            </div>

                            {totals.playoffRounds > 0 && (
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-sm text-gray-500">Player Cost Per Game (Playoffs)</p>
                                    <p className="mt-1 text-xl font-semibold">
                                        ${formatCurrency(totals.playoffPlayerCostPerGame)}
                                    </p>
                                </div>
                            )}

                            <div className="rounded-lg border bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">Estimated Team Fee</p>
                                <p className="mt-1 text-xl font-semibold">
                                    ${totals.billedTeamFee.toLocaleString()}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Exact: ${formatCurrency(totals.suggestedTeamFee)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Player Base */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-2xl font-semibold">Player Base</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span>Expected Players</span>
                                <span className="font-medium">{expectedTotalPlayers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Rostered Players</span>
                                <span className="font-medium">{totals.rosteredPlayers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Exemption Equivalent</span>
                                <span className="font-medium">{totals.exemptionEquivalent.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-3">
                                <span className="font-semibold">Effective Paying Players</span>
                                <span className="font-bold">{totals.effectivePayingPlayers.toFixed(2)}</span>
                            </div>
                            {playoffTeams > 0 && (
                                <div className="flex justify-between">
                                    <span>Playoff-Paying Players</span>
                                    <span className="font-medium">{totals.playoffPayingPlayers.toFixed(2)}</span>
                                </div>
                            )}
                            <p className="pt-2 text-xs text-gray-500">
                                Before rosters exist, the estimate uses expected total players.
                                After players and exemptions are added, this updates based on the
                                real payable player count.
                            </p>
                        </div>
                    </div>

                    {/* Regular Season Breakdown */}
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-2xl font-semibold">Regular Season Breakdown</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span>League Games</span>
                                <span className="font-medium">{totals.regularSeasonLeagueGames}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ice / Facility Cost</span>
                                <span className="font-medium">${formatCurrency(totals.regularIceTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Overhead (proportional)</span>
                                <span className="font-medium">${formatCurrency(totals.regularOverhead)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ref Cost</span>
                                <span className="font-medium">${formatCurrency(totals.regularRefTotalCost)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Reserve Amount</span>
                                <span className="font-medium">${formatCurrency(totals.regularReserveAmount)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-3 text-base">
                                <span className="font-semibold">Total Regular Season Cost</span>
                                <span className="font-bold">${formatCurrency(totals.totalRegularSeasonCost)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Playoff Breakdown */}
                    {playoffTeams > 0 && (
                        <div className="rounded-xl border bg-white p-6 shadow-sm">
                            <h2 className="mb-4 text-2xl font-semibold">Playoff Breakdown</h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span>Playoff Teams</span>
                                    <span className="font-medium">{playoffTeams}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Playoff Rounds</span>
                                    <span className="font-medium">{totals.playoffRounds}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Games Per Team ({playoffCostingModel === "worst_case" ? "worst case" : "estimated"})</span>
                                    <span className="font-medium">{totals.playoffGamesForCosting}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total Playoff League Games</span>
                                    <span className="font-medium">{totals.playoffLeagueGames}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Ice / Facility Cost</span>
                                    <span className="font-medium">${formatCurrency(totals.playoffIceTotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Overhead (proportional)</span>
                                    <span className="font-medium">${formatCurrency(totals.playoffOverhead)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Ref Cost</span>
                                    <span className="font-medium">${formatCurrency(totals.playoffRefTotalCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Reserve Amount</span>
                                    <span className="font-medium">${formatCurrency(totals.playoffReserveAmount)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-3 text-base">
                                    <span className="font-semibold">Total Playoff Cost</span>
                                    <span className="font-bold">${formatCurrency(totals.totalPlayoffCost)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
