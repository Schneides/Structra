import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Player = {
    id: number;
    first_name: string;
    last_name: string;
};

export default async function TeamRosterPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; teamId: string }>;
}) {
    const { id, seasonId, teamId } = await params;

    const { data: team } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

    const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .eq("season_id", seasonId)
        .order("last_name", { ascending: true });

    const players = (playersData ?? []) as Player[];

    const targetSlots = team?.target_roster_slots ?? 0;
    const openSlots = Math.max(targetSlots - players.length, 0);

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{team?.team_name}</h1>
                    <p className="mt-2 text-gray-600">
                        Team roster and player management
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster/new`}
                        className="rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Add Player
                    </Link>

                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/teams`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Back to Teams
                    </Link>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">
                    Roster ({players.length} / {targetSlots})
                </h2>

                <div className="space-y-2">
                    {players.map((player) => (
                        <Link
                            key={player.id}
                            href={`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster/${player.id}`}
                            className="block rounded-lg border p-4 hover:bg-gray-50"
                        >
                            {player.first_name} {player.last_name}
                        </Link>
                    ))}

                    {Array.from({ length: openSlots }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="rounded-lg border border-dashed p-4 text-gray-400"
                        >
                            Empty Slot
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}