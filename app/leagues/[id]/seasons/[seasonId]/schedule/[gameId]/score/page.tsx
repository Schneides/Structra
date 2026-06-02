"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Game = {
  id: number;
  league_id: number;
  season_id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  game_date: string | null;
  game_time: string | null;
  location: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  result_type: string | null;
};

type Team = {
  id: number;
  team_name: string;
};

export default function SetScorePage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string; gameId: string }>;
}) {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [gameId, setGameId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [resultType, setResultType] = useState("regulation");
  const [status, setStatus] = useState("completed");

  useEffect(() => {
    async function loadData() {
      const { id, seasonId, gameId } = await params;

      setLeagueId(id);
      setSeasonId(seasonId);
      setGameId(gameId);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", Number(gameId))
        .eq("league_id", Number(id))
        .eq("season_id", Number(seasonId))
        .single();

      if (gameError || !gameData) {
        setError("Could not load game.");
        setLoading(false);
        return;
      }

      const teamIds = [gameData.home_team_id, gameData.away_team_id].filter(
        (value): value is number => value !== null
      );

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, team_name")
        .in("id", teamIds.length > 0 ? teamIds : [-1]);

      if (teamsError) {
        setError("There was a problem loading teams.");
        setLoading(false);
        return;
      }

      setGame(gameData as Game);
      setTeams((teamsData ?? []) as Team[]);

      setHomeScore(
        gameData.home_score !== null && gameData.home_score !== undefined
          ? String(gameData.home_score)
          : ""
      );
      setAwayScore(
        gameData.away_score !== null && gameData.away_score !== undefined
          ? String(gameData.away_score)
          : ""
      );
      setResultType(gameData.result_type ?? "regulation");
      setStatus(gameData.status ?? "completed");

      setLoading(false);
    }

    loadData();
  }, [params]);

  const teamNameById = new Map<number, string>(
    teams.map((team) => [team.id, team.team_name])
  );

  const homeTeamName =
    game?.home_team_id !== null && game?.home_team_id !== undefined
      ? teamNameById.get(game.home_team_id) || "Unknown Team"
      : "Home Team Not Set";

  const awayTeamName =
    game?.away_team_id !== null && game?.away_team_id !== undefined
      ? teamNameById.get(game.away_team_id) || "Unknown Team"
      : "Away Team Not Set";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!game) {
        setError("Game not found.");
        return;
      }

      if (!game.home_team_id || !game.away_team_id) {
        setError("Set the home and away teams before entering a score.");
        return;
      }

      if (homeScore === "" || awayScore === "") {
        setError("Please enter both the home and away score.");
        return;
      }

      const numericHomeScore = Number(homeScore);
      const numericAwayScore = Number(awayScore);

      if (
        Number.isNaN(numericHomeScore) ||
        Number.isNaN(numericAwayScore) ||
        numericHomeScore < 0 ||
        numericAwayScore < 0
      ) {
        setError("Scores must be numbers greater than or equal to 0.");
        return;
      }

      if (resultType === "tie" && numericHomeScore !== numericAwayScore) {
        setError("Tie result type requires equal scores.");
        return;
      }

      if (
        (resultType === "overtime" || resultType === "shootout" || resultType === "regulation") &&
        numericHomeScore === numericAwayScore
      ) {
        setError("Regulation, overtime, and shootout results cannot end in a tie.");
        return;
      }

      const { error: updateError } = await supabase
        .from("games")
        .update({
          home_score: numericHomeScore,
          away_score: numericAwayScore,
          result_type: resultType,
          status,
        })
        .eq("id", Number(gameId))
        .eq("league_id", Number(leagueId))
        .eq("season_id", Number(seasonId));

      if (updateError) {
        setError("There was a problem saving the score.");
        return;
      }

      router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>Loading score page...</p>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold">Game not found</h1>
        <p className="mt-2 text-gray-600">
          We could not load that game.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Set Score</h1>
        <p className="mt-2 text-gray-600">
          Enter the final result for this game.
        </p>
      </div>

      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold">
          {homeTeamName} vs {awayTeamName}
        </p>
        <p className="mt-2 text-gray-600">
          Date: {game.game_date || "TBD"}
        </p>
        <p className="text-gray-600">
          Time: {game.game_time || "TBD"}
        </p>
        <p className="text-gray-600">
          Location: {game.location || "TBD"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
      >
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {homeTeamName} Score
            </label>
            <input
              type="number"
              min="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {awayTeamName} Score
            </label>
            <input
              type="number"
              min="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Result Type</label>
          <select
            value={resultType}
            onChange={(e) => setResultType(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          >
            <option value="regulation">Regulation</option>
            <option value="overtime">Overtime</option>
            <option value="shootout">Shootout</option>
            <option value="tie">Tie</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          >
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Score"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${leagueId}/seasons/${seasonId}/schedule/${gameId}`)
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