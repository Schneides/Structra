"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Team = {
    id: number;
    team_name: string;
};

type DraftPlayer = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    position: string | null;
    jersey_number: number | null;
    drafted_team_id: number | null;
};

type DraftOrderRow = {
    team_id: number;
    draft_position: number;
};

type DraftPick = {
    id: number;
    round_number: number;
    pick_number: number;
    draft_player_id: number | null;
    player_id: number | null;
    team_id: number;
};

type Season = {
    draft_type: string | null;
    expected_total_players: number | null;
    draft_completed_at: string | null;
};

type TeamLeader = {
    id: number;
    team_id: number;
    draft_player_id: number;
    role: "C" | "A";
};

type RosterPlayer = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    jersey_number: number | null;
    team_id: number | null;
};

function playerDisplay(firstName: string | null, lastName: string | null) {
    return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Unnamed Player";
}

export default function DraftBoardPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    const [loading, setLoading] = useState(true);
    const [drafting, setDrafting] = useState(false);
    const [completingDraft, setCompletingDraft] = useState(false);
    const [error, setError] = useState("");

    const [season, setSeason] = useState<Season | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([]);
    const [draftOrder, setDraftOrder] = useState<DraftOrderRow[]>([]);
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
    const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);

    useEffect(() => {
        async function loadData() {
            const { id, seasonId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);
            setError("");

            const leagueNumber = Number(id);
            const seasonNumber = Number(seasonId);

            const { data: seasonData } = await supabase
                .from("seasons")
                .select("draft_type, expected_total_players, draft_completed_at")
                .eq("id", seasonNumber)
                .eq("league_id", leagueNumber)
                .single();

            const { data: teamsData } = await supabase
                .from("teams")
                .select("id, team_name")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber)
                .order("team_name", { ascending: true });

            const { data: leadersData } = await supabase
                .from("team_leaders")
                .select("id, team_id, draft_player_id, role")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber);

            const loadedLeaders = (leadersData ?? []) as TeamLeader[];

            const { data: draftPlayersBeforeData } = await supabase
                .from("draft_players")
                .select("*")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber)
                .order("last_name", { ascending: true });

            const loadedDraftPlayersBefore =
                (draftPlayersBeforeData ?? []) as DraftPlayer[];

            // AUTO-ASSIGN LEADERS TO ROSTERS
            for (const leader of loadedLeaders) {
                const draftPlayer = loadedDraftPlayersBefore.find(
                    (player) => player.id === leader.draft_player_id
                );

                if (!draftPlayer) continue;

                const alreadyAssigned =
                    draftPlayer.drafted_team_id === leader.team_id;

                if (!alreadyAssigned) {
                    const { data: existingRosterPlayers } = await supabase
                        .from("players")
                        .select("id")
                        .eq("league_id", leagueNumber)
                        .eq("season_id", seasonNumber)
                        .eq("team_id", leader.team_id)
                        .eq("first_name", draftPlayer.first_name)
                        .eq("last_name", draftPlayer.last_name);

                    if (
                        !existingRosterPlayers ||
                        existingRosterPlayers.length === 0
                    ) {
                        await supabase.from("players").insert([
                            {
                                league_id: leagueNumber,
                                season_id: seasonNumber,
                                team_id: leader.team_id,
                                first_name: draftPlayer.first_name,
                                last_name: draftPlayer.last_name,
                                email: draftPlayer.email,
                                phone: draftPlayer.phone,
                                position: draftPlayer.position,
                                jersey_number: draftPlayer.jersey_number,
                                amount_paid: 0,
                                payment_status: "Unpaid",
                                payment_exemption_percent: 0,
                            },
                        ]);
                    }

                    await supabase
                        .from("draft_players")
                        .update({
                            drafted_team_id: leader.team_id,
                        })
                        .eq("id", draftPlayer.id)
                        .eq("league_id", leagueNumber)
                        .eq("season_id", seasonNumber);
                }
            }

            const { data: draftPlayersData } = await supabase
                .from("draft_players")
                .select("*")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber)
                .order("last_name", { ascending: true });

            const { data: rosterPlayersData } = await supabase
                .from("players")
                .select(
                    "id, first_name, last_name, position, jersey_number, team_id"
                )
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber);

            const { data: orderData } = await supabase
                .from("draft_order")
                .select("team_id, draft_position")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber)
                .order("draft_position", { ascending: true });

            const { data: picksData } = await supabase
                .from("draft_picks")
                .select("*")
                .eq("league_id", leagueNumber)
                .eq("season_id", seasonNumber)
                .order("pick_number", { ascending: true });

            setSeason(seasonData as Season);
            setTeams((teamsData ?? []) as Team[]);
            setDraftPlayers((draftPlayersData ?? []) as DraftPlayer[]);
            setDraftOrder((orderData ?? []) as DraftOrderRow[]);
            setDraftPicks((picksData ?? []) as DraftPick[]);
            setTeamLeaders(loadedLeaders);
            setRosterPlayers((rosterPlayersData ?? []) as RosterPlayer[]);
            setLoading(false);
        }

        loadData();
    }, [params]);

    const teamById = useMemo(
        () => new Map<number, Team>(teams.map((team) => [team.id, team])),
        [teams]
    );

    const playerById = useMemo(
        () =>
            new Map<number, DraftPlayer>(
                draftPlayers.map((player) => [player.id, player])
            ),
        [draftPlayers]
    );

    const leaderPlayerIds = useMemo(
        () => new Set(teamLeaders.map((leader) => leader.draft_player_id)),
        [teamLeaders]
    );

    const availablePlayers = useMemo(
        () =>
            draftPlayers.filter(
                (player) =>
                    !player.drafted_team_id &&
                    !leaderPlayerIds.has(player.id)
            ),
        [draftPlayers, leaderPlayerIds]
    );

    const teamsInOrder = draftOrder.map((row) => row.team_id);

    const rosteredPlayerCount = rosterPlayers.length;

    const expectedRosterCount =
        season?.expected_total_players ?? 0;

    const rosterLimitReached =
        expectedRosterCount > 0 &&
        rosteredPlayerCount >= expectedRosterCount;

    const substitutePlayers = availablePlayers;

    const currentPickNumber = draftPicks.length + 1;

    const currentRound =
        teamsInOrder.length > 0
            ? Math.floor((currentPickNumber - 1) / teamsInOrder.length) + 1
            : 1;

    const currentPickIndex =
        teamsInOrder.length > 0
            ? (currentPickNumber - 1) % teamsInOrder.length
            : 0;

    let activeTeamId: number | null = null;

    if (!rosterLimitReached && teamsInOrder.length > 0) {
        const isSnake = season?.draft_type === "snake";

        if (isSnake && currentRound % 2 === 0) {
            activeTeamId = [...teamsInOrder].reverse()[currentPickIndex];
        } else {
            activeTeamId = teamsInOrder[currentPickIndex];
        }
    }

    const activeTeam = activeTeamId
        ? teamById.get(activeTeamId)
        : null;

    const completeDraft = async () => {
        setCompletingDraft(true);
        setError("");

        const { error: completeError } = await supabase
            .from("seasons")
            .update({
                draft_completed_at: new Date().toISOString(),
            })
            .eq("id", Number(seasonId))
            .eq("league_id", Number(leagueId));

        if (completeError) {
            setCompletingDraft(false);
            setError("There was a problem completing the draft.");
            return;
        }

        setCompletingDraft(false);

        window.location.reload();
    };

    const makeDraftPick = async (draftPlayer: DraftPlayer) => {
        if (!activeTeamId) {
            setError("Draft is complete.");
            return;
        }

        setDrafting(true);
        setError("");

        const newPickNumber = draftPicks.length + 1;

        const { data: createdPlayer, error: playerInsertError } =
            await supabase
                .from("players")
                .insert([
                    {
                        league_id: Number(leagueId),
                        season_id: Number(seasonId),
                        team_id: activeTeamId,
                        first_name: draftPlayer.first_name,
                        last_name: draftPlayer.last_name,
                        email: draftPlayer.email,
                        phone: draftPlayer.phone,
                        position: draftPlayer.position,
                        jersey_number: draftPlayer.jersey_number,
                        amount_paid: 0,
                        payment_status: "Unpaid",
                        payment_exemption_percent: 0,
                    },
                ])
                .select("*")
                .single();

        if (playerInsertError || !createdPlayer) {
            setDrafting(false);
            setError("There was a problem creating the roster player.");
            return;
        }

        const { data: pickData, error: pickError } = await supabase
            .from("draft_picks")
            .insert([
                {
                    league_id: Number(leagueId),
                    season_id: Number(seasonId),
                    round_number: currentRound,
                    pick_number: newPickNumber,
                    draft_player_id: draftPlayer.id,
                    player_id: createdPlayer.id,
                    team_id: activeTeamId,
                    created_at: new Date().toISOString(),
                },
            ])
            .select("*")
            .single();

        if (pickError || !pickData) {
            setDrafting(false);
            setError(
                pickError?.message ||
                    "There was a problem saving the draft pick."
            );
            return;
        }

        await supabase
            .from("draft_players")
            .update({
                drafted_team_id: activeTeamId,
            })
            .eq("id", draftPlayer.id)
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId));

        setDraftPlayers((current) =>
            current.map((player) =>
                player.id === draftPlayer.id
                    ? {
                          ...player,
                          drafted_team_id: activeTeamId,
                      }
                    : player
            )
        );

        setRosterPlayers((current) => [
            ...current,
            {
                id: createdPlayer.id,
                first_name: createdPlayer.first_name,
                last_name: createdPlayer.last_name,
                position: createdPlayer.position,
                jersey_number: createdPlayer.jersey_number,
                team_id: createdPlayer.team_id,
            },
        ]);

        setDraftPicks((current) => [
            ...current,
            pickData as DraftPick,
        ]);

        setDrafting(false);
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-6 py-10">
                <p>Loading draft board...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">
                        Draft Board
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Run the live draft and assign players to teams.
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        Captains and alternate captains are automatically assigned to their teams.
                    </p>
                </div>

                <Link
                    href={`/leagues/${leagueId}/seasons/${seasonId}/draft`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center"
                >
                    Back to Draft
                </Link>
            </div>

            <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-6">
                    <div>
                        <p className="text-sm text-gray-500">
                            Round
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                            {currentRound}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">
                            Pick
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                            {currentPickNumber}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">
                            On The Clock
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                            {rosterLimitReached
                                ? "Ready to Complete"
                                : activeTeam?.team_name || "-"}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">
                            Rostered
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                            {rosteredPlayerCount} / {expectedRosterCount}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">
                            Available
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                            {availablePlayers.length}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">
                            Substitutes
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                            {substitutePlayers.length}
                        </p>
                    </div>
                </div>
            </div>

            {rosterLimitReached && !season?.draft_completed_at && (
                <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-semibold">
                        Roster Limit Reached
                    </h2>

                    <p className="mt-2 text-gray-600">
                        The season roster is full. Remaining available players can be treated as substitutes.
                    </p>

                    <button
                        type="button"
                        onClick={completeDraft}
                        disabled={completingDraft}
                        className="mt-5 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                    >
                        {completingDraft
                            ? "Completing..."
                            : "Complete Draft"}
                    </button>
                </div>
            )}

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-2xl font-semibold">
                        Available Players
                    </h2>

                    <div className="max-h-[600px] overflow-y-auto pr-2">
                        <div className="space-y-3">
                            {availablePlayers.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-lg border p-4"
                                >
                                    <div className="mb-3">
                                        <p className="font-medium">
                                            {playerDisplay(
                                                player.first_name,
                                                player.last_name
                                            )}
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            {player.position || "Position"} • Jersey #
                                            {player.jersey_number ?? "-"}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            makeDraftPick(player)
                                        }
                                        disabled={
                                            drafting ||
                                            rosterLimitReached
                                        }
                                        className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                                    >
                                        {rosterLimitReached
                                            ? "Substitute"
                                            : "Draft Player"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-2xl font-semibold">
                        Draft Order
                    </h2>

                    <div className="space-y-3">
                        {teamsInOrder.map((teamId, index) => {
                            const isCurrent =
                                !rosterLimitReached &&
                                activeTeamId === teamId;

                            return (
                                <div
                                    key={`${teamId}-${index}`}
                                    className={`rounded-lg border p-4 ${
                                        isCurrent
                                            ? "bg-black text-white"
                                            : ""
                                    }`}
                                >
                                    <p className="text-sm opacity-70">
                                        Position {index + 1}
                                    </p>

                                    <p className="font-semibold">
                                        {teamById.get(teamId)?.team_name}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-2xl font-semibold">
                        Recent Picks
                    </h2>

                    <div className="max-h-[600px] overflow-y-auto pr-2">
                        <div className="space-y-3">
                            {[...draftPicks]
                                .reverse()
                                .map((pick) => {
                                    const player =
                                        pick.draft_player_id
                                            ? playerById.get(
                                                  pick.draft_player_id
                                              )
                                            : null;

                                    return (
                                        <div
                                            key={pick.id}
                                            className="rounded-lg border p-4"
                                        >
                                            <p className="text-sm text-gray-500">
                                                Pick {pick.pick_number} • Round{" "}
                                                {pick.round_number}
                                            </p>

                                            <p className="mt-1 font-semibold">
                                                {
                                                    teamById.get(
                                                        pick.team_id
                                                    )?.team_name
                                                }
                                            </p>

                                            <p className="text-gray-600">
                                                {playerDisplay(
                                                    player?.first_name ??
                                                        "",
                                                    player?.last_name ??
                                                        ""
                                                )}
                                            </p>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </section>
            </div>

            <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold">
                    Live Team Rosters
                </h2>

                <p className="mt-2 text-sm text-gray-600">
                    Current team rosters update as captains, alternate captains, and draft picks are assigned.
                </p>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                    {teams.map((team) => {
                        const teamRoster = rosterPlayers.filter(
                            (player) => player.team_id === team.id
                        );

                        return (
                            <div
                                key={team.id}
                                className="rounded-xl border p-5"
                            >
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-2xl font-semibold">
                                        {team.team_name}
                                    </h3>

                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                        {teamRoster.length} players
                                    </span>
                                </div>

                                <div className="max-h-[320px] overflow-y-auto pr-2">
                                    <div className="space-y-3">
                                        {teamRoster.map((player) => {
                                            const leader =
                                                teamLeaders.find(
                                                    (leader) =>
                                                        leader.team_id ===
                                                            team.id &&
                                                        leader.draft_player_id ===
                                                            draftPlayers.find(
                                                                (draftPlayer) =>
                                                                    draftPlayer.first_name ===
                                                                        player.first_name &&
                                                                    draftPlayer.last_name ===
                                                                        player.last_name
                                                            )?.id
                                                );

                                            return (
                                                <div
                                                    key={player.id}
                                                    className="flex items-center justify-between rounded-lg border p-4"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {playerDisplay(
                                                                player.first_name,
                                                                player.last_name
                                                            )}
                                                        </p>

                                                        <p className="text-sm text-gray-500">
                                                            {player.position ||
                                                                "Position"}{" "}
                                                            • Jersey #
                                                            {player.jersey_number ??
                                                                "-"}
                                                        </p>
                                                    </div>

                                                    {leader && (
                                                        <div className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">
                                                            {leader.role}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}