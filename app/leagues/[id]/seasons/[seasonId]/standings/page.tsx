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

type Game = {
    home_team_id: number;
    away_team_id: number;
    status: string;
    result_type: string | null;
    home_score: number | null;
    away_score: number | null;
};

type StandingRow = {
    teamId: number;
    teamName: string;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    gamesPlayed: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifferential: number;
};

type SeasonSettings = {
    points_regulation_win: number | null;
    points_regulation_loss: number | null;
    points_tie: number | null;
    points_overtime_win: number | null;
    points_overtime_loss: number | null;
};

export default async function SeasonStandingsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const { id, seasonId } = await params;

    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    const { data: seasonData } = await supabase
        .from("seasons")
        .select(`
            *,
            points_regulation_win,
            points_regulation_loss,
            points_tie,
            points_overtime_win,
            points_overtime_loss
        `)
        .eq("id", seasonId)
        .eq("league_id", id)
        .single();

    const { data: teamsData } = await supabase
        .from("teams")
        .select("id, team_name")
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .order("team_name", { ascending: true });

    const { data: gamesData } = await supabase
        .from("games")
        .select("home_team_id, away_team_id, status, result_type, home_score, away_score")
        .eq("league_id", id)
        .eq("season_id", seasonId);

    const season = seasonData as SeasonSettings & { season_name?: string } | null;
    const teams = (teamsData ?? []) as Team[];
    const games = (gamesData ?? []) as Game[];

    const regulationWinPoints = season?.points_regulation_win ?? 2;
    const regulationLossPoints = season?.points_regulation_loss ?? 0;
    const tiePoints = season?.points_tie ?? 1;
    const overtimeWinPoints = season?.points_overtime_win ?? 2;
    const overtimeLossPoints = season?.points_overtime_loss ?? 1;

    const standingsMap = new Map<number, StandingRow>();

    for (const team of teams) {
        standingsMap.set(team.id, {
            teamId: team.id,
            teamName: team.team_name,
            wins: 0,
            losses: 0,
            ties: 0,
            points: 0,
            gamesPlayed: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifferential: 0,
        });
    }

    for (const game of games) {
        const isCompleted =
            game.status === "completed" &&
            game.home_score !== null &&
            game.away_score !== null;

        if (!isCompleted) continue;

        const homeTeam = standingsMap.get(game.home_team_id);
        const awayTeam = standingsMap.get(game.away_team_id);

        if (!homeTeam || !awayTeam) continue;

        const homeScore = game.home_score as number;
        const awayScore = game.away_score as number;
        const resultType = game.result_type ?? "regulation";

        homeTeam.gamesPlayed += 1;
        awayTeam.gamesPlayed += 1;

        homeTeam.goalsFor += homeScore;
        awayTeam.goalsFor += awayScore;
        homeTeam.goalsAgainst += awayScore;
        awayTeam.goalsAgainst += homeScore;
        homeTeam.goalDifferential = homeTeam.goalsFor - homeTeam.goalsAgainst;
        awayTeam.goalDifferential = awayTeam.goalsFor - awayTeam.goalsAgainst;

        if (resultType === "tie") {
            homeTeam.ties += 1;
            awayTeam.ties += 1;
            homeTeam.points += tiePoints;
            awayTeam.points += tiePoints;
            continue;
        }

        const isOvertimeStyleResult =
            resultType === "overtime" || resultType === "shootout";

        if (homeScore > awayScore) {
            homeTeam.wins += 1;
            awayTeam.losses += 1;

            if (isOvertimeStyleResult) {
                homeTeam.points += overtimeWinPoints;
                awayTeam.points += overtimeLossPoints;
            } else {
                homeTeam.points += regulationWinPoints;
                awayTeam.points += regulationLossPoints;
            }
        } else if (homeScore < awayScore) {
            awayTeam.wins += 1;
            homeTeam.losses += 1;

            if (isOvertimeStyleResult) {
                awayTeam.points += overtimeWinPoints;
                homeTeam.points += overtimeLossPoints;
            } else {
                awayTeam.points += regulationWinPoints;
                homeTeam.points += regulationLossPoints;
            }
        } else {
            homeTeam.ties += 1;
            awayTeam.ties += 1;
            homeTeam.points += tiePoints;
            awayTeam.points += tiePoints;
        }
    }

    const standings = Array.from(standingsMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.teamName.localeCompare(b.teamName);
    });

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Season Standings</h1>
                    <p className="mt-2 text-gray-600">
                        {league?.league_name} • {seasonData?.season_name}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        Standings are calculated from completed games with saved scores and result types.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}/standings/settings`}
                        className="rounded-lg bg-black px-5 py-3 text-white"
                    >
                        Standings Settings
                    </Link>

                    <Link
                        href={`/leagues/${id}/seasons/${seasonId}`}
                        className="rounded-lg border px-5 py-3"
                    >
                        Back to Season
                    </Link>
                </div>
            </div>

            <div className="mb-8">
                <div className="mb-3">
                    <h2 className="text-xl font-semibold">Point Settings</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        These values control how wins, losses, ties, overtime, and shootout results are scored.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">Regulation Win</p>
                        <p className="mt-1 text-lg font-semibold">{regulationWinPoints}</p>
                    </div>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">Regulation Loss</p>
                        <p className="mt-1 text-lg font-semibold">{regulationLossPoints}</p>
                    </div>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">Tie</p>
                        <p className="mt-1 text-lg font-semibold">{tiePoints}</p>
                    </div>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">OT / SO Win</p>
                        <p className="mt-1 text-lg font-semibold">{overtimeWinPoints}</p>
                    </div>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">OT / SO Loss</p>
                        <p className="mt-1 text-lg font-semibold">{overtimeLossPoints}</p>
                    </div>
                </div>
            </div>

            {standings.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">No standings yet</h2>
                    <p className="mt-2 text-gray-600">
                        Complete games with scores to generate standings.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <table className="min-w-full">
                        <thead className="border-b bg-gray-50">
                            <tr className="text-left text-sm text-gray-600">
                                <th className="px-4 py-3">Team</th>
                                <th className="px-4 py-3">GP</th>
                                <th className="px-4 py-3">W</th>
                                <th className="px-4 py-3">L</th>
                                <th className="px-4 py-3">T</th>
                                <th className="px-4 py-3">PTS</th>
                                <th className="px-4 py-3">GF</th>
                                <th className="px-4 py-3">GA</th>
                                <th className="px-4 py-3">+/-</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((team) => (
                                <tr key={team.teamId} className="border-b text-sm">
                                    <td className="px-4 py-3 font-medium">
                                        {team.teamName}
                                    </td>
                                    <td className="px-4 py-3">{team.gamesPlayed}</td>
                                    <td className="px-4 py-3">{team.wins}</td>
                                    <td className="px-4 py-3">{team.losses}</td>
                                    <td className="px-4 py-3">{team.ties}</td>
                                    <td className="px-4 py-3 font-semibold">{team.points}</td>
                                    <td className="px-4 py-3">{team.goalsFor}</td>
                                    <td className="px-4 py-3">{team.goalsAgainst}</td>
                                    <td className="px-4 py-3">
                                        {team.goalDifferential > 0
                                            ? `+${team.goalDifferential}`
                                            : team.goalDifferential}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}