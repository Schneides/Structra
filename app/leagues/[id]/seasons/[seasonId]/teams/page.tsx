import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Team = {
    id: number;
    league_id: number;
    season_id: number;
    team_name: string;
    team_color: string | null;
    target_roster_slots: number | null;
};

type PlayerCountRow = {
    team_id: number;
};

export default async function SeasonTeamsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = await params;

    const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    const { data: season, error: seasonError } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .eq("league_id", id)
        .single();

    const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .order("id", { ascending: true });

    const { data: playersData } = await supabase
        .from("players")
        .select("team_id")
        .eq("league_id", id)
        .eq("season_id", seasonId);

    if (leagueError || !league || seasonError || !season) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <h1 className="text-3xl font-bold">Season not found</h1>
                <p className="mt-2 text-gray-600">
                    We could not load that season.
                </p>
            </main>
        );
    }

    const teams = (teamsData ?? []) as Team[];
    const players = (playersData ?? []) as PlayerCountRow[];

    const playerCountByTeam = new Map<number, number>();

    for (const player of players) {
        const current = playerCountByTeam.get(player.team_id) ?? 0;
        playerCountByTeam.set(player.team_id, current + 1);
    }

    const expectedTotalPlayers = Number(season.expected_total_players ?? 0);
    const totalAssignedSlots = teams.reduce(
        (sum, team) => sum + Number(team.target_roster_slots ?? 0),
        0
    );
    const totalFilledPlayers = players.length;
    const totalOpenSlots = Math.max(totalAssignedSlots - totalFilledPlayers, 0);
    const slotDifference = totalAssignedSlots - expectedTotalPlayers;

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Season Teams</h1>
                    <p className="mt-2 text-gray-600">
                        {league.league_name} • {season.season_name}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/teams/new`}
                        className="inline-block rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Add Team
                    </Link>

                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}`}
                        className="inline-block rounded-lg border px-5 py-3"
                    >
                        Back to Season
                    </Link>
                </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Season Expected Players</p>
                    <p className="mt-2 text-2xl font-bold">{expectedTotalPlayers}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Total Assigned Slots</p>
                    <p className="mt-2 text-2xl font-bold">{totalAssignedSlots}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Filled Players</p>
                    <p className="mt-2 text-2xl font-bold">{totalFilledPlayers}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Open Slots</p>
                    <p className="mt-2 text-2xl font-bold">{totalOpenSlots}</p>
                </div>
            </div>

            {slotDifference !== 0 && (
                <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
                    Team slot totals do not match the season expected players. Assigned slots are{" "}
                    <span className="font-semibold">{Math.abs(slotDifference)}</span>{" "}
                    {slotDifference > 0 ? "over" : "under"} the season total.
                </div>
            )}

            {slotDifference === 0 && (
                <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
                    Team slot totals are aligned with the season expected total players.
                </div>
            )}

            {teamsError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
                    There was a problem loading teams.
                </div>
            )}

            {!teamsError && teams.length === 0 && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No teams yet</h2>
                    <p className="mt-2 text-gray-600">
                        Add the first team for this season.
                    </p>
                </div>
            )}

            {!teamsError && teams.length > 0 && (
                <div className="grid gap-4">
                    {teams.map((team) => {
                        const playerCount = playerCountByTeam.get(team.id) ?? 0;
                        const targetSlots = team.target_roster_slots ?? 0;
                        const openSlots = Math.max(targetSlots - playerCount, 0);

                        return (
                            <div
                                key={team.id}
                                className="rounded-xl border bg-white p-6 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold">
                                            <Link
                                                href={`/leagues/${id}/seasons/${seasonId}/teams/${team.id}/edit`}
                                                className="hover:underline"
                                            >
                                                {team.team_name}
                                            </Link>
                                        </h2>
                                        <p className="mt-1 text-gray-600">
                                            Color: {team.team_color || "Not set"}
                                        </p>
                                    </div>

                                    <Link
                                        href={`/leagues/${id}/seasons/${seasonId}/teams/${team.id}/roster`}
                                        className="rounded-lg border px-4 py-2 text-sm"
                                    >
                                        View Roster
                                    </Link>
                                </div>

                                <div className="mt-5 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Target Roster Slots</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {targetSlots}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Players Added</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {playerCount}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border bg-gray-50 p-4">
                                        <p className="text-sm text-gray-500">Open Slots</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {openSlots}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}