"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Team = {
    id: number;
    team_name: string;
    team_color: string | null;
};

type DraftPlayer = {
    id: number;
    first_name: string | null;
    last_name: string | null;
};

type TeamLeader = {
    id: number;
    team_id: number;
    draft_player_id: number;
    role: "C" | "A";
};

function playerName(player: DraftPlayer) {
    return `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Unnamed Player";
}

export default function DraftTeamsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = use(params);

    const [loading, setLoading] = useState(true);
    const [savingTeamId, setSavingTeamId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const [leagueName, setLeagueName] = useState("");
    const [seasonName, setSeasonName] = useState("");
    const [seasonTeamCount, setSeasonTeamCount] = useState(0);

    const [teams, setTeams] = useState<Team[]>([]);
    const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);

    const [teamNames, setTeamNames] = useState<Record<number, string>>({});
    const [captainSelections, setCaptainSelections] = useState<Record<number, string>>({});
    const [alternateSelections, setAlternateSelections] = useState<Record<number, string[]>>({});

    async function loadData() {
        setLoading(true);
        setError("");

        const { data: leagueData } = await supabase
            .from("leagues")
            .select("league_name")
            .eq("id", Number(id))
            .single();

        const { data: seasonData, error: seasonError } = await supabase
            .from("seasons")
            .select("season_name, num_teams, expected_total_players")
            .eq("id", Number(seasonId))
            .eq("league_id", Number(id))
            .single();

        if (seasonError || !seasonData) {
            setError("There was a problem loading this season.");
            setLoading(false);
            return;
        }

        setLeagueName(leagueData?.league_name ?? "");
        setSeasonName(seasonData.season_name ?? "");
        setSeasonTeamCount(Number(seasonData.num_teams ?? 0));

        let { data: teamsData, error: teamsError } = await supabase
            .from("teams")
            .select("id, team_name, team_color")
            .eq("league_id", Number(id))
            .eq("season_id", Number(seasonId))
            .order("id", { ascending: true });

        if (teamsError) {
            setError("There was a problem loading draft teams.");
            setLoading(false);
            return;
        }

        if ((!teamsData || teamsData.length === 0) && Number(seasonData.num_teams ?? 0) > 0) {
            const teamCount = Number(seasonData.num_teams ?? 0);
            const expectedPlayers = Number(seasonData.expected_total_players ?? 0);
            const baseSlots = teamCount > 0 ? Math.floor(expectedPlayers / teamCount) : 0;
            const remainder = teamCount > 0 ? expectedPlayers % teamCount : 0;

            const teamsToCreate = Array.from({ length: teamCount }, (_, index) => ({
                league_id: Number(id),
                season_id: Number(seasonId),
                team_name: `Team ${index + 1}`,
                team_color: "",
                target_roster_slots: index < remainder ? baseSlots + 1 : baseSlots,
            }));

            const { error: createTeamsError } = await supabase
                .from("teams")
                .insert(teamsToCreate);

            if (createTeamsError) {
                setError(createTeamsError.message || "Teams were missing, and there was a problem auto-creating them.");
                setLoading(false);
                return;
            }

            const reload = await supabase
                .from("teams")
                .select("id, team_name, team_color")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("id", { ascending: true });

            teamsData = reload.data ?? [];
        }

        const { data: draftPlayersData, error: draftPlayersError } = await supabase
            .from("draft_players")
            .select("id, first_name, last_name")
            .eq("league_id", Number(id))
            .eq("season_id", Number(seasonId))
            .order("last_name", { ascending: true });

        if (draftPlayersError) {
            setError("There was a problem loading draft pool players.");
            setLoading(false);
            return;
        }

        const { data: leadersData, error: leadersError } = await supabase
            .from("team_leaders")
            .select("id, team_id, draft_player_id, role")
            .eq("league_id", Number(id))
            .eq("season_id", Number(seasonId));

        if (leadersError) {
            setError(leadersError.message || "There was a problem loading team leaders.");
            setLoading(false);
            return;
        }

        const loadedTeams = (teamsData ?? []) as Team[];
        const loadedDraftPlayers = (draftPlayersData ?? []) as DraftPlayer[];
        const loadedLeaders = (leadersData ?? []) as TeamLeader[];

        setTeams(loadedTeams);
        setDraftPlayers(loadedDraftPlayers);
        setTeamLeaders(loadedLeaders);

        const names: Record<number, string> = {};
        const captains: Record<number, string> = {};
        const alternates: Record<number, string[]> = {};

        loadedTeams.forEach((team) => {
            names[team.id] = team.team_name ?? "";

            const captain = loadedLeaders.find(
                (leader) => leader.team_id === team.id && leader.role === "C"
            );

            const alternateLeaders = loadedLeaders.filter(
                (leader) => leader.team_id === team.id && leader.role === "A"
            );

            captains[team.id] = captain ? String(captain.draft_player_id) : "";
            alternates[team.id] = alternateLeaders.map((leader) =>
                String(leader.draft_player_id)
            );
        });

        setTeamNames(names);
        setCaptainSelections(captains);
        setAlternateSelections(alternates);

        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, [id, seasonId]);

    function addAlternate(teamId: number) {
        setAlternateSelections((current) => ({
            ...current,
            [teamId]: [...(current[teamId] ?? []), ""],
        }));
    }

    function updateAlternate(teamId: number, index: number, value: string) {
        setAlternateSelections((current) => {
            const existing = [...(current[teamId] ?? [])];
            existing[index] = value;

            return {
                ...current,
                [teamId]: existing,
            };
        });
    }

    function removeAlternate(teamId: number, index: number) {
        setAlternateSelections((current) => {
            const existing = [...(current[teamId] ?? [])];
            existing.splice(index, 1);

            return {
                ...current,
                [teamId]: existing,
            };
        });
    }

    const saveTeam = async (teamId: number) => {
        setSavingTeamId(teamId);
        setError("");

        const selectedCaptainId = captainSelections[teamId] || "";
        const selectedAlternateIds = (alternateSelections[teamId] ?? []).filter(Boolean);

        const selectedIds = [selectedCaptainId, ...selectedAlternateIds].filter(Boolean);
        const uniqueIds = new Set(selectedIds);

        if (selectedIds.length !== uniqueIds.size) {
            setSavingTeamId(null);
            setError("A player cannot be assigned to more than one leadership role on the same team.");
            return;
        }

        const { error: teamSaveError } = await supabase
            .from("teams")
            .update({
                team_name: teamNames[teamId] || "Unnamed Team",
            })
            .eq("id", teamId)
            .eq("league_id", Number(id))
            .eq("season_id", Number(seasonId));

        if (teamSaveError) {
            setSavingTeamId(null);
            setError(teamSaveError.message || "There was a problem saving this team.");
            return;
        }

        const { error: deleteLeadersError } = await supabase
            .from("team_leaders")
            .delete()
            .eq("league_id", Number(id))
            .eq("season_id", Number(seasonId))
            .eq("team_id", teamId);

        if (deleteLeadersError) {
            setSavingTeamId(null);
            setError(deleteLeadersError.message || "There was a problem clearing old team leaders.");
            return;
        }

        const leadersToInsert = [];

        if (selectedCaptainId) {
            leadersToInsert.push({
                league_id: Number(id),
                season_id: Number(seasonId),
                team_id: teamId,
                draft_player_id: Number(selectedCaptainId),
                role: "C",
            });
        }

        selectedAlternateIds.forEach((alternateId) => {
            leadersToInsert.push({
                league_id: Number(id),
                season_id: Number(seasonId),
                team_id: teamId,
                draft_player_id: Number(alternateId),
                role: "A",
            });
        });

        if (leadersToInsert.length > 0) {
            const { error: insertLeadersError } = await supabase
                .from("team_leaders")
                .insert(leadersToInsert);

            if (insertLeadersError) {
                setSavingTeamId(null);
                setError(insertLeadersError.message || "There was a problem saving team leaders.");
                return;
            }
        }

        setSavingTeamId(null);
        await loadData();
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-6xl px-6 py-10">
                <p>Loading draft teams...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Draft Teams</h1>
                    <p className="mt-2 text-gray-600">
                        {leagueName} • {seasonName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        Rename teams, assign one captain, and add as many alternate captains as needed.
                    </p>
                </div>

                <Link
                    href={`/leagues/${id}/seasons/${seasonId}/draft`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                >
                    Back to Draft
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {draftPlayers.length === 0 && (
                <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                    Add players to the draft pool first, then return here to assign captains and alternate captains.
                </div>
            )}

            {teams.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No draft teams found</h2>
                    <p className="mt-2 text-gray-600">
                        This season is set to {seasonTeamCount} teams, but no team rows could be created.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {teams.map((team, index) => (
                        <div key={team.id} className="rounded-xl border bg-white p-6 shadow-sm">
                            <div className="mb-5">
                                <p className="text-sm text-gray-500">Draft Team {index + 1}</p>
                                <h2 className="text-2xl font-semibold">
                                    {teamNames[team.id] || team.team_name}
                                </h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Team Name
                                    </label>
                                    <input
                                        value={teamNames[team.id] ?? ""}
                                        onChange={(e) =>
                                            setTeamNames((current) => ({
                                                ...current,
                                                [team.id]: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Captain (C)
                                    </label>
                                    <select
                                        value={captainSelections[team.id] ?? ""}
                                        onChange={(e) =>
                                            setCaptainSelections((current) => ({
                                                ...current,
                                                [team.id]: e.target.value,
                                            }))
                                        }
                                        disabled={draftPlayers.length === 0}
                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                                    >
                                        <option value="">No captain selected</option>
                                        {draftPlayers.map((player) => (
                                            <option key={player.id} value={player.id}>
                                                {playerName(player)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium">
                                            Alternate Captains (A)
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => addAlternate(team.id)}
                                            disabled={draftPlayers.length === 0}
                                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Add Alternate
                                        </button>
                                    </div>

                                    {(alternateSelections[team.id] ?? []).length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            No alternate captains added.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {(alternateSelections[team.id] ?? []).map((alternateId, altIndex) => (
                                                <div key={altIndex} className="flex gap-3">
                                                    <select
                                                        value={alternateId}
                                                        onChange={(e) =>
                                                            updateAlternate(team.id, altIndex, e.target.value)
                                                        }
                                                        disabled={draftPlayers.length === 0}
                                                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                                                    >
                                                        <option value="">Select alternate captain</option>
                                                        {draftPlayers.map((player) => (
                                                            <option key={player.id} value={player.id}>
                                                                {playerName(player)}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeAlternate(team.id, altIndex)}
                                                        className="rounded-lg border px-4 py-3 text-sm hover:bg-gray-50"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => saveTeam(team.id)}
                                    disabled={savingTeamId === team.id}
                                    className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                                >
                                    {savingTeamId === team.id ? "Saving..." : "Save Team"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}