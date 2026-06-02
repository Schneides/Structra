import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Team = {
    id: number;
    team_name: string;
};

type DraftPlayer = {
    id: number;
    drafted_team_id: number | null;
};

type DraftPick = {
    id: number;
};

type DraftOrder = {
    id: number;
    team_id: number;
    draft_position: number;
};

type TeamLeader = {
    id: number;
    team_id: number;
    draft_player_id: number;
    role: "C" | "A";
};

type Game = {
    id: number;
    status: string | null;
    home_score: number | null;
    away_score: number | null;
};

function getStatusBadge(status: "Completed" | "In Progress" | "Locked") {
    if (status === "Completed") {
        return (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Completed
            </span>
        );
    }

    if (status === "Locked") {
        return (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Locked
            </span>
        );
    }

    return (
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
            In Progress
        </span>
    );
}

export default async function SeasonDraftPage({
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

    const { data: teamsData } = await supabase
        .from("teams")
        .select("id, team_name")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .order("team_name", { ascending: true });

    const { data: draftPlayersData } = await supabase
        .from("draft_players")
        .select("id, drafted_team_id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: teamLeadersData } = await supabase
        .from("team_leaders")
        .select("id, team_id, draft_player_id, role")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: picksData } = await supabase
        .from("draft_picks")
        .select("id")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const { data: draftOrderData } = await supabase
        .from("draft_order")
        .select("id, team_id, draft_position")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .order("draft_position", { ascending: true });

    const { data: gamesData } = await supabase
        .from("games")
        .select("id, status, home_score, away_score")
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId));

    const teams = (teamsData ?? []) as Team[];
    const draftPlayers = (draftPlayersData ?? []) as DraftPlayer[];
    const teamLeaders = (teamLeadersData ?? []) as TeamLeader[];
    const picks = (picksData ?? []) as DraftPick[];
    const draftOrder = (draftOrderData ?? []) as DraftOrder[];
    const games = (gamesData ?? []) as Game[];

    const draftCompleted = Boolean(season?.draft_completed_at);

    const scoreEntered = games.some(
        (game) =>
            game.status === "completed" ||
            game.home_score !== null ||
            game.away_score !== null
    );

    const redoDraftLocked = !draftCompleted || scoreEntered;

    const availablePlayers = draftPlayers.filter(
        (player) => player.drafted_team_id === null
    );

    const draftedPlayers = draftPlayers.filter(
        (player) => player.drafted_team_id !== null
    );

    const captainTeamIds = new Set(
        teamLeaders
            .filter((leader) => leader.role === "C")
            .map((leader) => leader.team_id)
    );

    const captainsAssignedCount = captainTeamIds.size;

    const allCaptainsAssigned =
        teams.length > 0 && captainsAssignedCount === teams.length;

    const playerPoolStatus =
        draftPlayers.length > 0 ? "Completed" : "In Progress";

    const teamsStatus =
        teams.length > 0 && allCaptainsAssigned ? "Completed" : "In Progress";

    const draftOrderStatus = draftCompleted
        ? "Locked"
        : draftOrder.length === teams.length && teams.length > 0
          ? "Completed"
          : "In Progress";

    const draftBoardUnlocked =
        draftPlayers.length > 0 &&
        teams.length > 0 &&
        allCaptainsAssigned &&
        draftOrder.length === teams.length;

    const nextStep = draftCompleted
        ? "Draft complete. Continue to payments."
        : draftPlayers.length === 0
          ? "Add players to the draft pool."
          : !allCaptainsAssigned
            ? "Assign one captain to each draft team."
            : draftOrder.length !== teams.length
              ? "Set the draft order."
              : "Open the draft board and begin making picks.";

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Season Draft</h1>
                    <p className="mt-2 text-gray-600">
                        {league?.league_name} • {season?.season_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        Build teams by drafting players from an available player pool.
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                >
                    Back to Season
                </Link>
            </div>

            <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                    Next Draft Step
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{nextStep}</h2>
                <p className="mt-2 text-sm text-gray-600">
                    {draftCompleted
                        ? "The draft has been completed. Draft order is locked."
                        : "Complete the setup in order before opening the live draft board."}
                </p>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Teams</p>
                    <p className="mt-2 text-2xl font-bold">{teams.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Available/Sub Players</p>
                    <p className="mt-2 text-2xl font-bold">{availablePlayers.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Drafted Players</p>
                    <p className="mt-2 text-2xl font-bold">{draftedPlayers.length}</p>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">Picks Made</p>
                    <p className="mt-2 text-2xl font-bold">{picks.length}</p>
                </div>
            </div>

            <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold">Draft Setup</h2>
                    <p className="mt-2 text-gray-600">
                        Follow these steps in order: player pool, teams and captains,
                        draft order, then draft board.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/draft/players`}
                        className="block rounded-xl border p-5 hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-semibold">
                                1. Draft Player Pool
                            </h3>
                            {getStatusBadge(playerPoolStatus)}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            Add available players. After the draft is complete, new players can be treated as substitutes.
                        </p>
                        <p className="mt-3 text-xs text-gray-500">
                            Pool players: {draftPlayers.length}
                        </p>
                    </Link>

                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/draft/teams`}
                        className="block rounded-xl border p-5 hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-semibold">
                                2. Manage Teams & Captains
                            </h3>
                            {getStatusBadge(teamsStatus)}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            Rename teams, assign one captain per team, and add optional alternates.
                        </p>
                        <p className="mt-3 text-xs text-gray-500">
                            Captains assigned: {captainsAssignedCount} / {teams.length}
                        </p>
                    </Link>

                    {draftCompleted ? (
                        <div className="block rounded-xl border bg-gray-50 p-5 text-gray-500">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl font-semibold">
                                    3. Set Draft Order
                                </h3>
                                {getStatusBadge("Locked")}
                            </div>
                            <p className="mt-2 text-sm">
                                Draft order is locked because the draft has been completed.
                            </p>
                            <p className="mt-3 text-xs">
                                Teams in order: {draftOrder.length} / {teams.length}
                            </p>
                        </div>
                    ) : (
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/draft/order`}
                            className="block rounded-xl border p-5 hover:bg-gray-50"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl font-semibold">
                                    3. Set Draft Order
                                </h3>
                                {getStatusBadge(draftOrderStatus)}
                            </div>
                            <p className="mt-2 text-sm text-gray-600">
                                Choose or randomize the team picking order before the draft begins.
                            </p>
                            <p className="mt-3 text-xs text-gray-500">
                                Teams in order: {draftOrder.length} / {teams.length}
                            </p>
                        </Link>
                    )}

                    {draftBoardUnlocked ? (
                        <Link
                            href={`/leagues/${id}/seasons/${seasonId}/draft/board`}
                            className="block rounded-xl border bg-black p-5 text-white hover:bg-gray-800"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl font-semibold">
                                    4. Open Draft Board
                                </h3>
                                {getStatusBadge("Completed")}
                            </div>
                            <p className="mt-2 text-sm text-gray-200">
                                {draftCompleted
                                    ? "View completed draft results and live team rosters."
                                    : "Start making picks and assigning players to teams."}
                            </p>
                        </Link>
                    ) : (
                        <div className="block rounded-xl border bg-gray-50 p-5 text-gray-500">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-xl font-semibold">
                                    4. Open Draft Board
                                </h3>
                                {getStatusBadge("Locked")}
                            </div>
                            <p className="mt-2 text-sm">
                                Complete the draft pool, captains, and draft order before opening the board.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {draftCompleted && (
                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">Draft Complete</h2>
                            <p className="mt-2 text-sm text-gray-600">
                                The draft is locked. Remaining undrafted players can stay available as substitutes.
                            </p>

                            <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                                Redoing a draft should only be used before games are played. It can reset draft picks,
                                drafted roster assignments, substitute status, and may affect player-related stats if the
                                season has already started.
                            </div>

                            {scoreEntered && (
                                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                                    Redo Draft is locked because at least one game has a completed status or score entered.
                                </div>
                            )}
                        </div>

                        {redoDraftLocked ? (
                            <div className="flex min-h-[48px] items-center justify-center rounded-lg border bg-gray-100 px-5 py-3 text-center text-sm font-medium text-gray-500">
                                Redo Draft Locked
                            </div>
                        ) : (
                            <Link
                                href={`/leagues/${id}/seasons/${seasonId}/draft/redo`}
                                className="flex min-h-[48px] items-center justify-center rounded-lg border border-red-300 bg-red-50 px-5 py-3 text-center text-sm font-medium text-red-700 hover:bg-red-100"
                            >
                                Redo Draft
                            </Link>
                        )}
                    </div>
                </section>
            )}
        </main>
    );
}