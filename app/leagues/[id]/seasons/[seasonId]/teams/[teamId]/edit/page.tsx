"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type TeamRow = {
  id: number;
  team_name: string | null;
  team_color: string | null;
  target_roster_slots: number | null;
};

type PlayerRow = {
  team_id: number;
};

type SeasonRow = {
  expected_total_players: number | null;
};

export default function EditSeasonTeamPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string; teamId: string }>;
}) {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("");
  const [targetRosterSlots, setTargetRosterSlots] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTeam() {
      const { id, seasonId, teamId } = await params;

      setLeagueId(id);
      setSeasonId(seasonId);
      setTeamId(teamId);

      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .single();

      if (error || !data) {
        alert("Could not load team.");
        router.push(`/leagues/${id}/seasons/${seasonId}/teams`);
        return;
      }

      setTeamName(data.team_name ?? "");
      setTeamColor(data.team_color ?? "");
      setTargetRosterSlots(String(data.target_roster_slots ?? 0));
      setLoading(false);
    }

    loadTeam();
  }, [params, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const newSlots = targetRosterSlots ? Number(targetRosterSlots) : 0;

    if (Number.isNaN(newSlots) || newSlots < 0) {
      setSubmitting(false);
      setErrorMessage("Target roster slots must be 0 or greater.");
      return;
    }

    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select("expected_total_players")
      .eq("id", seasonId)
      .eq("league_id", leagueId)
      .single();

    if (seasonError || !seasonData) {
      setSubmitting(false);
      setErrorMessage("Could not load season total players.");
      return;
    }

    const season = seasonData as SeasonRow;
    const seasonTotalPlayers = Number(season.expected_total_players ?? 0);

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, team_name, team_color, target_roster_slots")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("id", { ascending: true });

    if (teamsError || !teamsData) {
      setSubmitting(false);
      setErrorMessage("Could not load season teams.");
      return;
    }

    const teams = (teamsData ?? []) as TeamRow[];

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("team_id")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId);

    if (playersError) {
      setSubmitting(false);
      setErrorMessage("Could not load roster counts.");
      return;
    }

    const players = (playersData ?? []) as PlayerRow[];

    const actualPlayersByTeam = new Map<number, number>();
    for (const player of players) {
      const current = actualPlayersByTeam.get(player.team_id) ?? 0;
      actualPlayersByTeam.set(player.team_id, current + 1);
    }

    const currentTeam = teams.find((t) => String(t.id) === teamId);
    if (!currentTeam) {
      setSubmitting(false);
      setErrorMessage("Could not find the team being edited.");
      return;
    }

    const currentSlots = Number(currentTeam.target_roster_slots ?? 0);
    const currentActualPlayers = actualPlayersByTeam.get(currentTeam.id) ?? 0;

    if (newSlots < currentActualPlayers) {
      setSubmitting(false);
      setErrorMessage(
        `This team already has ${currentActualPlayers} players. You cannot reduce its target slots below that number.`
      );
      return;
    }

    const currentTotalSlots = teams.reduce(
      (sum, team) => sum + Number(team.target_roster_slots ?? 0),
      0
    );

    if (currentTotalSlots !== seasonTotalPlayers) {
      setSubmitting(false);
      setErrorMessage(
        `Current team slot totals (${currentTotalSlots}) do not match the season expected total players (${seasonTotalPlayers}). Please edit the season total first or rebalance team slots before making more changes.`
      );
      return;
    }

    const delta = newSlots - currentSlots;

    const updatedTargets = new Map<number, number>();
    for (const team of teams) {
      updatedTargets.set(team.id, Number(team.target_roster_slots ?? 0));
    }

    updatedTargets.set(currentTeam.id, newSlots);

    if (delta > 0) {
      let remainingToReduce = delta;

      const otherTeams = teams.filter((t) => t.id !== currentTeam.id);

      for (const team of otherTeams) {
        if (remainingToReduce <= 0) break;

        const existingTarget = updatedTargets.get(team.id) ?? 0;
        const actualPlayers = actualPlayersByTeam.get(team.id) ?? 0;
        const availableToReduce = existingTarget - actualPlayers;

        if (availableToReduce <= 0) continue;

        const reduction = Math.min(availableToReduce, remainingToReduce);
        updatedTargets.set(team.id, existingTarget - reduction);
        remainingToReduce -= reduction;
      }

      if (remainingToReduce > 0) {
        setSubmitting(false);
        setErrorMessage(
          "This change exceeds the season’s expected total players. Edit the season total first, or reduce another team with available open slots."
        );
        return;
      }
    }

    if (delta < 0) {
      let remainingToAdd = Math.abs(delta);
      const otherTeams = teams.filter((t) => t.id !== currentTeam.id);

      let index = 0;
      while (remainingToAdd > 0 && otherTeams.length > 0) {
        const team = otherTeams[index % otherTeams.length];
        const existingTarget = updatedTargets.get(team.id) ?? 0;
        updatedTargets.set(team.id, existingTarget + 1);
        remainingToAdd -= 1;
        index += 1;
      }
    }

    const finalTotalSlots = Array.from(updatedTargets.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    if (finalTotalSlots !== seasonTotalPlayers) {
      setSubmitting(false);
      setErrorMessage(
        "There was a problem keeping team slots aligned with the season total players."
      );
      return;
    }

    const teamsToUpdate = teams.map((team) => ({
      id: team.id,
      team_name: team.id === currentTeam.id ? teamName : team.team_name,
      team_color: team.id === currentTeam.id ? teamColor : team.team_color,
      target_roster_slots: updatedTargets.get(team.id) ?? 0,
    }));

    for (const team of teamsToUpdate) {
      const { error } = await supabase
        .from("teams")
        .update({
          team_name: team.team_name,
          team_color: team.team_color,
          target_roster_slots: team.target_roster_slots,
        })
        .eq("id", team.id)
        .eq("league_id", leagueId)
        .eq("season_id", seasonId);

      if (error) {
        setSubmitting(false);
        setErrorMessage("There was a problem updating team slot distribution.");
        return;
      }
    }

    setSubmitting(false);
    router.push(`/leagues/${leagueId}/seasons/${seasonId}/teams`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>Loading team...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Team</h1>
        <p className="mt-2 text-gray-600">
          Update this team and its roster slot target for the current season.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
      >
        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">Team Name</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Team Color</label>
          <input
            type="text"
            value={teamColor}
            onChange={(e) => setTeamColor(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Target Roster Slots</label>
          <input
            type="number"
            min="0"
            value={targetRosterSlots}
            onChange={(e) => setTargetRosterSlots(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
          <p className="mt-1 text-sm text-gray-500">
            Changing this will automatically rebalance other teams to keep the season total players consistent.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${leagueId}/seasons/${seasonId}/teams`)
            }
            className="rounded-lg border px-6 py-3"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}