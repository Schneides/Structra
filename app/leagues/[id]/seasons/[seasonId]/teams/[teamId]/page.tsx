import DeleteSeasonTeamButton from "./DeleteSeasonTeamButton";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function SeasonTeamDetailPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; teamId: string }>;
}) {
    const { id, seasonId, teamId } = await params;

    const { data: team, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .single();

    if (error || !team) {
        return (
            <main className="mx-auto max-w-4xl px-6 py-10">
                <h1 className="text-3xl font-bold">Team not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not find that team.
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-4xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{team.team_name}</h1>
                <p className="text-gray-600">
                    Color: {team.team_color || "Not set"}
                </p>

                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/edit`}
                    className="inline-block rounded-lg bg-black px-5 py-3 text-white"
                  >
                    Edit Team
                  </Link>

                  <Link
                    href={`/leagues/${id}/seasons/${seasonId}/teams/${team.id}/roster`}
                    className="inline-block rounded-lg border px-5 py-3"
                  >
                    Roster
                  </Link>

                  <DeleteSeasonTeamButton
                    leagueId={Number(id)}
                    seasonId={Number(seasonId)}
                    teamId={Number(team.id)}
                  />

                  <Link
                    href={`/leagues/${id}/seasons/${seasonId}/teams`}
                    className="inline-block rounded-lg border px-5 py-3"
                  >
                    Back to Season Teams
                  </Link>
                </div>
            </div>
        </main>
    );
}