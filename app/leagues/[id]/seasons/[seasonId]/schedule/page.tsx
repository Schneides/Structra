"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type League = {
  id: number;
  league_name: string;
};

type Season = {
  id: number;
  season_name: string;
  num_teams: number | null;
  regular_season_games: number | null;
  playoff_games: number | null;
};

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
  game_type: string | null;
  game_number: number | null;
  created_at: string | null;
};

type Team = {
  id: number;
  team_name: string;
};

export default function SeasonSchedulePage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id, seasonId } = use(params);

  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("id, league_name")
      .eq("id", id)
      .single();

    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select("id, season_name, num_teams, regular_season_games, playoff_games")
      .eq("id", seasonId)
      .eq("league_id", id)
      .single();

    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .eq("league_id", id)
      .eq("season_id", seasonId)
      .order("game_number", { ascending: true });

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, team_name")
      .eq("league_id", id)
      .eq("season_id", seasonId)
      .order("id", { ascending: true });

    if (leagueError || seasonError || gamesError || teamsError) {
      setErrorMessage("There was a problem loading the schedule.");
      setLoading(false);
      return;
    }

    setLeague((leagueData ?? null) as League | null);
    setSeason((seasonData ?? null) as Season | null);
    setGames((gamesData ?? []) as Game[]);
    setTeams((teamsData ?? []) as Team[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id, seasonId]);

  const teamNameById = useMemo(() => {
    return new Map<number, string>(teams.map((team) => [team.id, team.team_name]));
  }, [teams]);

  const regularGames = useMemo(
    () => games.filter((game) => (game.game_type ?? "regular") === "regular"),
    [games]
  );

  const playoffGames = useMemo(
    () => games.filter((game) => game.game_type === "playoff"),
    [games]
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";

    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "TBD";

    const [hours, minutes] = timeString.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleGenerateSchedule = async () => {
    if (!season) return;

    setGenerating(true);
    setErrorMessage("");

    const numTeams = Number(season.num_teams ?? 0);
    const regularSeasonGamesPerTeam = Number(season.regular_season_games ?? 0);
    const playoffGamesCount = Number(season.playoff_games ?? 0);

    if (numTeams <= 0) {
      setGenerating(false);
      setErrorMessage("This season does not have a valid number of teams.");
      return;
    }

    const regularSeasonLeagueGames =
      numTeams > 0 ? (numTeams * regularSeasonGamesPerTeam) / 2 : 0;

    const gamesToInsert: Array<Record<string, unknown>> = [];

    for (let i = 0; i < regularSeasonLeagueGames; i++) {
      gamesToInsert.push({
        league_id: Number(id),
        season_id: Number(seasonId),
        home_team_id: null,
        away_team_id: null,
        game_date: null,
        game_time: null,
        location: null,
        status: "scheduled",
        home_score: null,
        away_score: null,
        result_type: "regulation",
        game_type: "regular",
        game_number: i + 1,
      });
    }

    for (let i = 0; i < playoffGamesCount; i++) {
      gamesToInsert.push({
        league_id: Number(id),
        season_id: Number(seasonId),
        home_team_id: null,
        away_team_id: null,
        game_date: null,
        game_time: null,
        location: null,
        status: "scheduled",
        home_score: null,
        away_score: null,
        result_type: "regulation",
        game_type: "playoff",
        game_number: regularSeasonLeagueGames + i + 1,
      });
    }

    const { error } = await supabase.from("games").insert(gamesToInsert);

    setGenerating(false);

    if (error) {
      setErrorMessage("There was a problem generating schedule placeholders.");
      return;
    }

    await loadData();
  };

  const renderGameCard = (game: Game) => {
    const homeTeam =
      game.home_team_id !== null
        ? teamNameById.get(game.home_team_id) || "Unknown Team"
        : "Select Home Team";

    const awayTeam =
      game.away_team_id !== null
        ? teamNameById.get(game.away_team_id) || "Unknown Team"
        : "Select Away Team";

    return (
      <Link
        key={game.id}
        href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}`}
        className="block rounded-xl border bg-white p-6 shadow-sm hover:bg-gray-50"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              Game {game.game_number ?? game.id}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {homeTeam} vs {awayTeam}
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {game.status || "scheduled"}
          </span>
        </div>

        <div className="mt-4 space-y-1 text-gray-600">
          <p>Date: {formatDate(game.game_date)}</p>
          <p>Time: {formatTime(game.game_time)}</p>
          <p>Location: {game.location || "TBD"}</p>
        </div>

        {(game.home_score !== null || game.away_score !== null) && (
          <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-sm">
            Score: {game.home_score ?? 0} - {game.away_score ?? 0}
          </div>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p>Loading schedule...</p>
      </main>
    );
  }

  if (!league || !season) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Season not found</h1>
        <p className="mt-2 text-gray-600">
          We could not load that season schedule.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Season Schedule</h1>
          <p className="mt-2 text-gray-600">
            {league.league_name} • {season.season_name}
          </p>
        </div>

        <div className="flex gap-3">
          {games.length > 0 && (
            <Link
              href={`/leagues/${id}/seasons/${seasonId}/schedule/new`}
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              Add Game
            </Link>
          )}

          <Link
            href={`/leagues/${id}/seasons/${seasonId}`}
            className="rounded-lg border px-5 py-3"
          >
            Back to Season
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {games.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No schedule created</h2>
          <p className="mt-2 text-gray-600">
            Generate schedule placeholders to create all regular season and playoff game slots for this season.
          </p>

          <button
            type="button"
            onClick={handleGenerateSchedule}
            disabled={generating}
            className="mt-4 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Schedule"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Regular Season</h2>
              <p className="text-sm text-gray-500">
                {regularGames.length} game{regularGames.length === 1 ? "" : "s"}
              </p>
            </div>

            {regularGames.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 shadow-sm text-gray-600">
                No regular season games created.
              </div>
            ) : (
              <div className="grid gap-4">
                {regularGames.map(renderGameCard)}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Playoffs</h2>
              <p className="text-sm text-gray-500">
                {playoffGames.length} game{playoffGames.length === 1 ? "" : "s"}
              </p>
            </div>

            {playoffGames.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 shadow-sm text-gray-600">
                No playoff games created.
              </div>
            ) : (
              <div className="grid gap-4">
                {playoffGames.map(renderGameCard)}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}