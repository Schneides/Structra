"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import DeleteSeasonButton from "../DeleteSeasonButton";

type TeamRow = {
  id: number;
  target_roster_slots: number | null;
};

type PlayerRow = {
  team_id: number;
};

export default function EditSeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [seasonName, setSeasonName] = useState("");
  const [numTeams, setNumTeams] = useState("");
  const [expectedTotalPlayers, setExpectedTotalPlayers] = useState("");
  const [regularSeasonGames, setRegularSeasonGames] = useState("");
  const [playoffGames, setPlayoffGames] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadSeason() {
      const { id, seasonId } = await params;

      setLeagueId(id);
      setSeasonId(seasonId);

      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .eq("league_id", id)
        .single();

      if (error || !data) {
        alert("Could not load season.");
        router.push(`/leagues/${id}/seasons`);
        return;
      }

      setSeasonName(data.season_name ?? "");
      setNumTeams(String(data.num_teams ?? 0));
      setExpectedTotalPlayers(String(data.expected_total_players ?? 0));
      setRegularSeasonGames(String(data.regular_season_games ?? 0));
      setPlayoffGames(String(data.playoff_games ?? 0));

      setLoading(false);
    }

    loadSeason();
  }, [params, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const newExpectedTotalPlayers = expectedTotalPlayers
      ? Number(expectedTotalPlayers)
      : 0;

    const newNumTeams = numTeams ? Number(numTeams) : 0;

    if (Number.isNaN(newExpectedTotalPlayers) || newExpectedTotalPlayers < 0) {
      setSubmitting(false);
      setErrorMessage("Expected total players must be 0 or greater.");
      return;
    }

    if (Number.isNaN(newNumTeams) || newNumTeams <= 0) {
      setSubmitting(false);
      setErrorMessage("Number of teams must be greater than 0.");
      return;
    }

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, target_roster_slots")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("id", { ascending: true });

    if (teamsError) {
      setSubmitting(false);
      setErrorMessage("Could not load teams for season rebalancing.");
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
      setErrorMessage("Could not load player counts for this season.");
      return;
    }

    const players = (playersData ?? []) as PlayerRow[];

    const actualPlayersByTeam = new Map<number, number>();

    for (const player of players) {
      const current = actualPlayersByTeam.get(player.team_id) ?? 0;
      actualPlayersByTeam.set(player.team_id, current + 1);
    }

    const currentTotalSlots = teams.reduce(
      (sum, team) => sum + Number(team.target_roster_slots ?? 0),
      0
    );

    const delta = newExpectedTotalPlayers - currentTotalSlots;

    const updatedTargets = new Map<number, number>();

    for (const team of teams) {
      updatedTargets.set(team.id, Number(team.target_roster_slots ?? 0));
    }

    if (delta > 0) {
      let remainingToAdd = delta;
      let index = 0;

      while (remainingToAdd > 0 && teams.length > 0) {
        const team = teams[index % teams.length];
        const currentTarget = updatedTargets.get(team.id) ?? 0;
        updatedTargets.set(team.id, currentTarget + 1);
        remainingToAdd -= 1;
        index += 1;
      }
    }

    if (delta < 0) {
      let remainingToReduce = Math.abs(delta);

      for (const team of teams) {
        if (remainingToReduce <= 0) break;

        const currentTarget = updatedTargets.get(team.id) ?? 0;
        const actualPlayers = actualPlayersByTeam.get(team.id) ?? 0;
        const availableToReduce = currentTarget - actualPlayers;

        if (availableToReduce <= 0) continue;

        const reduction = Math.min(availableToReduce, remainingToReduce);
        updatedTargets.set(team.id, currentTarget - reduction);
        remainingToReduce -= reduction;
      }

      if (remainingToReduce > 0) {
        setSubmitting(false);
        setErrorMessage(
          "You cannot reduce expected total players that low because one or more teams already have too many real players assigned. Remove players first or choose a higher season total."
        );
        return;
      }
    }

    const { error: seasonError } = await supabase
      .from("seasons")
      .update({
        season_name: seasonName,
        num_teams: newNumTeams,
        expected_total_players: newExpectedTotalPlayers,
        regular_season_games: regularSeasonGames
          ? Number(regularSeasonGames)
          : 0,
        playoff_games: playoffGames ? Number(playoffGames) : 0,
      })
      .eq("id", seasonId)
      .eq("league_id", leagueId);

    if (seasonError) {
      setSubmitting(false);
      setErrorMessage("There was a problem updating the season.");
      return;
    }

    for (const team of teams) {
      const newTarget = updatedTargets.get(team.id) ?? 0;

      const { error: teamUpdateError } = await supabase
        .from("teams")
        .update({
          target_roster_slots: newTarget,
        })
        .eq("id", team.id)
        .eq("league_id", leagueId)
        .eq("season_id", seasonId);

      if (teamUpdateError) {
        setSubmitting(false);
        setErrorMessage(
          "Season updated, but there was a problem rebalancing team slots."
        );
        return;
      }
    }

    setSubmitting(false);
    router.push(`/leagues/${leagueId}/seasons/${seasonId}`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>Loading season...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Season</h1>
        <p className="mt-2 text-gray-600">
          Update season settings and rebalance team slot totals if needed.
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
          <label className="mb-2 block text-sm font-medium">Season Name</label>
          <input
            type="text"
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Number of Teams
          </label>
          <input
            type="number"
            value={numTeams}
            onChange={(e) => setNumTeams(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
          <p className="mt-1 text-sm text-gray-500">
            Changing team count after setup may require additional manual cleanup, so use carefully.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Expected Total Players
          </label>
          <input
            type="number"
            value={expectedTotalPlayers}
            onChange={(e) => setExpectedTotalPlayers(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
          <p className="mt-1 text-sm text-gray-500">
            This is the season-wide total that team roster slots must add up to.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Regular Season Games Per Team
          </label>
          <input
            type="number"
            value={regularSeasonGames}
            onChange={(e) => setRegularSeasonGames(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Playoff Games</label>
          <input
            type="number"
            value={playoffGames}
            onChange={(e) => setPlayoffGames(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="flex gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/leagues/${leagueId}/seasons/${seasonId}`)}
            className="rounded-lg border px-6 py-3"
          >
            Cancel
          </button>
        </div>
      </form>

      <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-2 text-sm text-red-600">
          Deleting this season should only be used for test seasons or seasons created by mistake.
          This action removes the season and may affect related season data.
        </p>

        <div className="mt-5">
          <DeleteSeasonButton
            leagueId={Number(leagueId)}
            seasonId={Number(seasonId)}
          />
        </div>
      </section>
    </main>
  );
}