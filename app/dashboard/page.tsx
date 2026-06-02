import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type League = {
  id: number;
  league_name: string;
  sport: string | null;
};

type Season = {
  id: number;
  league_id: number;
  season_name: string | null;
  roster_setup_type: string | null;
  suggested_player_fee: number | null;
};

function FinanceBadge({ fee }: { fee: number | null }) {
  const done = Number(fee ?? 0) > 0;
  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Finance set
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Finance needed
    </span>
  );
}

export default async function DashboardPage() {
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, league_name, sport")
    .order("id", { ascending: false });

  const leagueList = (leagues ?? []) as League[];
  const leagueIds = leagueList.map((l) => l.id);

  const { data: seasonsData } =
    leagueIds.length > 0
      ? await supabase
          .from("seasons")
          .select("id, league_id, season_name, roster_setup_type, suggested_player_fee")
          .in("league_id", leagueIds)
          .order("id", { ascending: false })
      : { data: [] };

  const seasons = (seasonsData ?? []) as Season[];

  const seasonsByLeague = new Map<number, Season[]>();
  for (const season of seasons) {
    const current = seasonsByLeague.get(season.league_id) ?? [];
    current.push(season);
    seasonsByLeague.set(season.league_id, current);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Structra
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Your leagues, seasons, and current setup status at a glance.
            </p>
          </div>
          <Link
            href="/leagues/new"
            className="shrink-0 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
          >
            New League
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            There was a problem loading your leagues. Please refresh the page.
          </div>
        )}

        {/* Empty state */}
        {!error && leagueList.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">No leagues yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Create your first league to start building seasons, drafts, and schedules.
            </p>
            <Link
              href="/leagues/new"
              className="mt-6 inline-block rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Create League
            </Link>
          </div>
        )}

        {/* League cards */}
        {!error && leagueList.length > 0 && (
          <div className="grid gap-4">
            {leagueList.map((league) => {
              const leagueSeasons = seasonsByLeague.get(league.id) ?? [];
              const latestSeason = leagueSeasons[0];

              const setupLabel =
                latestSeason?.roster_setup_type === "draft"
                  ? "Draft"
                  : latestSeason?.roster_setup_type === "manual"
                  ? "Manual"
                  : null;

              return (
                <div
                  key={league.id}
                  className="rounded-2xl border bg-white shadow-sm"
                >
                  {/* League header */}
                  <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
                    <div>
                      <Link
                        href={`/leagues/${league.id}`}
                        className="text-xl font-bold text-gray-900 hover:underline"
                      >
                        {league.league_name}
                      </Link>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {league.sport ?? "Sport not set"}
                        {setupLabel && (
                          <span className="ml-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                            {setupLabel}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/leagues/${league.id}`}
                        className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-gray-50"
                      >
                        View
                      </Link>
                      <Link
                        href={`/leagues/${league.id}/seasons/new`}
                        className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                      >
                        Add Season
                      </Link>
                    </div>
                  </div>

                  {/* Stat strip */}
                  <div className="grid grid-cols-2 gap-px border-t bg-gray-100 sm:grid-cols-3">
                    <div className="bg-white px-6 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Seasons
                      </p>
                      <p className="mt-0.5 text-xl font-bold text-gray-900">
                        {leagueSeasons.length}
                      </p>
                    </div>
                    <div className="bg-white px-6 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Active Season
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
                        {latestSeason?.season_name ?? "—"}
                      </p>
                    </div>
                    <div className="col-span-2 bg-white px-6 py-3 sm:col-span-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Finance Status
                      </p>
                      <div className="mt-1">
                        {latestSeason ? (
                          <FinanceBadge fee={latestSeason.suggested_player_fee} />
                        ) : (
                          <span className="text-sm text-gray-400">No seasons</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Season rows */}
                  {leagueSeasons.length > 0 && (
                    <div className="divide-y border-t">
                      {leagueSeasons.map((season) => (
                        <Link
                          key={season.id}
                          href={`/leagues/${league.id}/seasons/${season.id}`}
                          className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-900">
                              {season.season_name}
                            </span>
                            {season.roster_setup_type && (
                              <span className="hidden rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-400 sm:inline">
                                {season.roster_setup_type === "draft" ? "Draft" : "Manual"}
                              </span>
                            )}
                          </div>
                          <FinanceBadge fee={season.suggested_player_fee} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
