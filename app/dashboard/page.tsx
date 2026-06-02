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

export default async function DashboardPage() {
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, league_name, sport")
    .order("id", { ascending: false });

  const leagueList = (leagues ?? []) as League[];
  const leagueIds = leagueList.map((league) => league.id);

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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage your leagues, seasons, drafts, payments, schedules, and stats.
          </p>
        </div>

        <Link
          href="/leagues/new"
          className="rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800"
        >
          Create League
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          There was a problem loading leagues.
        </div>
      )}

      {!error && leagueList.length === 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">No leagues yet</h2>
          <p className="mt-2 text-gray-600">
            Create your first league to start building seasons.
          </p>
        </div>
      )}

      {!error && leagueList.length > 0 && (
        <div className="grid gap-5">
          {leagueList.map((league) => {
            const leagueSeasons = seasonsByLeague.get(league.id) ?? [];
            const latestSeason = leagueSeasons[0];

            const setupType =
              latestSeason?.roster_setup_type === "draft"
                ? "Draft"
                : latestSeason?.roster_setup_type === "manual"
                ? "Manual Rosters"
                : "Not Set";

            const financeStatus =
              latestSeason && Number(latestSeason.suggested_player_fee ?? 0) > 0
                ? "Finance Started"
                : "Finance Not Started";

            return (
              <div
                key={league.id}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-xl font-semibold">
                      <Link
                        href={`/leagues/${league.id}`}
                        className="hover:underline"
                      >
                        {league.league_name}
                      </Link>
                    </h2>

                    <p className="mt-1 text-gray-600">
                      {league.sport || "Sport not set"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/leagues/${league.id}`}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      View League
                    </Link>

                    <Link
                      href={`/leagues/${league.id}/seasons/new`}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Add Season
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Seasons</p>
                    <p className="mt-1 text-2xl font-bold">
                      {leagueSeasons.length}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Latest Season</p>
                    <p className="mt-1 text-lg font-bold">
                      {latestSeason?.season_name || "None Yet"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Setup Type</p>
                    <p className="mt-1 text-lg font-bold">{setupType}</p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Finance</p>
                    <p className="mt-1 text-lg font-bold">{financeStatus}</p>
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