import Link from "next/link";
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
