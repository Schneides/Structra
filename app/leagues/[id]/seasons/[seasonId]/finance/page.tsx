import Link from "next/link";
import FinanceEditor from "./FinanceEditor";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function SeasonFinancePage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = await params;

    const { data: league } = await supabase
        .from("leagues")
        .select("id, league_name")
        .eq("id", id)
        .single();

    const { data: season, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .eq("league_id", id)
        .single();

    if (error || !season) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="mx-auto max-w-6xl px-6 py-10">
                    <h1 className="text-3xl font-bold">Season not found</h1>
                    <p className="mt-2 text-gray-500">We could not load that season.</p>
                    <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
                        Back to Dashboard
                    </Link>
                </main>
            </div>
        );
    }

    return (
        <FinanceEditor
            parentLeagueId={Number(id)}
            seasonId={Number(season.id)}
            leagueName={league?.league_name ?? ""}
            seasonName={season.season_name ?? ""}
            regularGames={Number(season.regular_season_games ?? 0)}
            numTeams={Number(season.num_teams ?? 0)}
            expectedTotalPlayers={Number(season.expected_total_players ?? 0)}
            initialIceCostPerGame={Number(season.ice_cost_per_game ?? 500)}
            initialReservePercent={Number(season.reserve_percent ?? 10)}
            initialRefModel={season.ref_model ?? "external"}
            initialRefCostPerGame={Number(season.ref_cost_per_game ?? 50)}
            initialRefsPerGame={Number(season.refs_per_game ?? 0)}
            initialExpenseMode={season.expense_mode ?? "monthly"}
            initialExpenseAmount={Number(season.expense_amount ?? 0)}
            initialSeasonLengthMonths={Number(season.season_length_months ?? 1)}
            initialOneTimeAdminCost={Number(season.one_time_admin_cost ?? 0)}
            playoffTeams={Number(season.playoff_teams ?? 0)}
            playoffGamesPerRoundForCosting={Number(season.playoff_games_per_round_for_costing ?? 1)}
            initialFinancePaymentModel={season.finance_payment_model ?? "regular_plus_playoff_actual"}
            initialPlayoffCostAllocation={season.playoff_cost_allocation ?? "playoff_teams_only"}
            initialPlayoffCostingModel={season.playoff_costing_model ?? "worst_case"}
            initialPlayoffPaymentModel={season.playoff_payment_model ?? "pay_as_you_advance"}
        />
    );
}
