import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function DraftPlayerPoolPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = await params;

    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    const { data: season } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .eq("league_id", id)
        .single();

    const { data: players } = await supabase
        .from("players")
        .select("*")
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .order("last_name", { ascending: true });

    const playerPool = players ?? [];

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Draft Player Pool</h1>
                    <p className="mt-2 text-gray-600">
                        {league?.league_name} • {season?.season_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        These are the players available for the draft.
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/draft`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center"
                >
                    Back to Draft
                </Link>
            </div>

            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold">Available Players</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Current player pool: {playerPool.length} player
                            {playerPool.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/teams`}
                        className="rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Manage Players
                    </Link>
                </div>
            </div>

            {playerPool.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No players yet</h2>
                    <p className="mt-2 text-gray-600">
                        Add players first, then return here to use them in the draft.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <table className="min-w-full">
                        <thead className="border-b bg-gray-50">
                            <tr className="text-left text-sm text-gray-600">
                                <th className="px-4 py-3">Player</th>
                                <th className="px-4 py-3">Position</th>
                                <th className="px-4 py-3">Jersey</th>
                                <th className="px-4 py-3">Current Team</th>
                                <th className="px-4 py-3">Draft Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {playerPool.map((player) => (
                                <tr key={player.id} className="border-b text-sm">
                                    <td className="px-4 py-3 font-medium">
                                        {player.first_name} {player.last_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {player.position || "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        {player.jersey_number ?? "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        {player.team_id ? `Team ID ${player.team_id}` : "Unassigned"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                            Available
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}