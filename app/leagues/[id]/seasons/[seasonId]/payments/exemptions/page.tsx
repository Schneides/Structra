import { createClient } from "@supabase/supabase-js";
import PaymentsEditor from "../PaymentsEditor";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function PaymentExemptionsPage({
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

    const { data: players, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .order("last_name", { ascending: true });

    const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .order("team_name", { ascending: true });

    if (!league || !season) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <h1 className="text-3xl font-bold">Season not found</h1>
                <p className="mt-2 text-gray-600">We could not load that season.</p>
            </main>
        );
    }

    return (
        <PaymentsEditor
            leagueId={id}
            seasonId={seasonId}
            leagueName={league.league_name}
            seasonName={season.season_name}
            initialPlayers={players ?? []}
            initialTeams={teams ?? []}
            playersError={!!playersError}
            teamsError={!!teamsError}
            initialSuggestedPlayerFee={Number(season.suggested_player_fee ?? 0)}
            lockedMode="exemptions"
        />
    );
}