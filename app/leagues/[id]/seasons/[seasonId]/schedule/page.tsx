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

function GameStatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "scheduled").toLowerCase();
  if (s === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Completed
      </span>
    );
  }
  if (s === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {status}
    </span>
  );
}

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
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
        : "Home TBD";

    const awayTeam =
      game.away_team_id !== null
        ? teamNameById.get(game.away_team_id) || "Unknown Team"
        : "Away TBD";

    const hasScore = game.home_score !== null || game.away_score !== null;

    return (
      <Link
        key={game.id}
        href={`/leagues/${id}/seasons/${seasonId}/schedule/${game.id}`}
        className="group block rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Game {game.game_number ?? game.id}
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900 group-hover:underline">
              {homeTeam} vs {awayTeam}
            </p>
          </div>
          <GameStatusBadge status={game.status} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{formatDate(game.game_date)}</span>
          <span>{formatTime(game.game_time)}</span>
          <span>{game.location || "Location TBD"}</span>
        </div>

        {hasScore && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-900">
            {game.home_score ?? 0} – {game.away_score ?? 0}
          </div>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6 h-4 w-64 animate-pulse rounded bg-gray-200" />
          <div className="mb-8 flex items-start justify-between">
            <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!league || !season) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-3xl font-bold">Season not found</h1>
          <p className="mt-2 text-gray-500">We could not load that season schedule.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-6 py-8">

        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard" className="transition-colors hover:text-gray-700">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/leagues/${id}`} className="transition-colors hover:text-gray-700">
            {league.league_name}
          </Link>
          <span>/</span>
          <Link href={`/leagues/${id}/seasons/${seasonId}`} className="transition-colors hover:text-gray-700">
            {season.season_name}
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-700">Schedule</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Season Schedule
            </h1>
            <p className="mt-2 text-sm text-gray-500">{season.season_name}</p>
          </div>

          <div className="flex shrink-0 gap-2">
            {games.length > 0 && (
              <Link
                href={`/leagues/${id}/seasons/${seasonId}/schedule/new`}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
              >
                Add Game
              </Link>
            )}
            <Link
              href={`/leagues/${id}/seasons/${seasonId}`}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
            >
              Back to Season
            </Link>
          </div>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Empty state */}
        {games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <p className="text-base font-semibold text-gray-900">No schedule created</p>
            <p className="mt-2 text-sm text-gray-500">
              Generate schedule placeholders to create all regular season and playoff game slots for this season.
            </p>
            <button
              type="button"
              onClick={handleGenerateSchedule}
              disabled={generating}
              className="mt-6 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Schedule"}
            </button>
          </div>
        ) : (
          <div className="space-y-10">

            {/* Regular Season */}
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900">Regular Season</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {regularGames.length} game{regularGames.length === 1 ? "" : "s"}
                </span>
              </div>

              {regularGames.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
                  No regular season games created.
                </div>
              ) : (
                <div className="grid gap-3">
                  {regularGames.map(renderGameCard)}
                </div>
              )}
            </section>

            {/* Playoffs */}
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900">Playoffs</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {playoffGames.length} game{playoffGames.length === 1 ? "" : "s"}
                </span>
              </div>

              {playoffGames.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
                  No playoff games created.
                </div>
              ) : (
                <div className="grid gap-3">
                  {playoffGames.map(renderGameCard)}
                </div>
              )}
            </section>

          </div>
        )}

      </main>
    </div>
  );
}
