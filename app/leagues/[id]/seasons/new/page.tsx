"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type StructureType = "none" | "conferences_divisions" | "divisions";

export default function NewSeasonPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();

    const [seasonName, setSeasonName] = useState("");
    const [rosterSetupType, setRosterSetupType] = useState("manual");

    const [numTeams, setNumTeams] = useState("");
    const [expectedPlayers, setExpectedPlayers] = useState("");

    const [structureType, setStructureType] = useState<StructureType>("none");
    const [numConferences, setNumConferences] = useState("");
    const [numDivisions, setNumDivisions] = useState("");

    const [regularSeasonGames, setRegularSeasonGames] = useState("");
    const [playoffTeams, setPlayoffTeams] = useState("");
    const [playoffQualification, setPlayoffQualification] = useState("league_points");
    const [playoffSeriesType, setPlayoffSeriesType] = useState("single_elimination");
    const [playoffGamesPerRoundForCosting, setPlayoffGamesPerRoundForCosting] =
        useState("1");

    const [estimatedExemptPlayers, setEstimatedExemptPlayers] = useState("");
    const [saving, setSaving] = useState(false);

    const playoffQualificationOptions = [
        {
            value: "league_points",
            label: "Top teams by league points",
            show: true,
        },
        {
            value: "division_points",
            label: "Top teams by division",
            show: structureType === "divisions" || structureType === "conferences_divisions",
        },
        {
            value: "conference_points",
            label: "Top teams by conference",
            show: structureType === "conferences_divisions",
        },
        {
            value: "commissioner_custom",
            label: "Custom commissioner selection",
            show: true,
        },
    ].filter((option) => option.show);

    const handleStructureTypeChange = (value: StructureType) => {
        setStructureType(value);

        if (value === "none") {
            setNumConferences("");
            setNumDivisions("");
            if (
                playoffQualification === "division_points" ||
                playoffQualification === "conference_points"
            ) {
                setPlayoffQualification("league_points");
            }
        }

        if (value === "divisions") {
            setNumConferences("");
            if (playoffQualification === "conference_points") {
                setPlayoffQualification("league_points");
            }
        }

        if (value === "conferences_divisions") {
            if (!numConferences) setNumConferences("2");
            if (!numDivisions) setNumDivisions("4");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const { id } = await params;

        const teamsCount = numTeams ? Number(numTeams) : 0;
        const totalPlayers = expectedPlayers ? Number(expectedPlayers) : 0;
        const regularGames = regularSeasonGames ? Number(regularSeasonGames) : 0;
        const playoffTeamCount = playoffTeams ? Number(playoffTeams) : 0;
        const conferenceCount = numConferences ? Number(numConferences) : 0;
        const divisionCount = numDivisions ? Number(numDivisions) : 0;
        const playoffGamesPerRound = playoffGamesPerRoundForCosting
            ? Number(playoffGamesPerRoundForCosting)
            : 1;
        const exemptionEstimate = estimatedExemptPlayers
            ? Number(estimatedExemptPlayers)
            : 0;

        if (!seasonName.trim()) {
            setSaving(false);
            alert("Please enter a season name.");
            return;
        }

        if (teamsCount <= 0) {
            setSaving(false);
            alert("Please enter a valid number of teams.");
            return;
        }

        if (totalPlayers <= 0) {
            setSaving(false);
            alert("Please enter the expected total number of players.");
            return;
        }

        if (regularGames <= 0) {
            setSaving(false);
            alert("Please enter the number of regular season games per team.");
            return;
        }

        if (playoffTeamCount < 0 || playoffTeamCount > teamsCount) {
            setSaving(false);
            alert("Playoff teams cannot be greater than total teams.");
            return;
        }

        if (structureType === "conferences_divisions" && conferenceCount <= 0) {
            setSaving(false);
            alert("Please enter the number of conferences.");
            return;
        }

        if (
            (structureType === "divisions" ||
                structureType === "conferences_divisions") &&
            divisionCount <= 0
        ) {
            setSaving(false);
            alert("Please enter the number of divisions.");
            return;
        }

        if (playoffGamesPerRound <= 0) {
            setSaving(false);
            alert("Please enter a valid playoff games per round value.");
            return;
        }

        const playoffRounds =
            playoffTeamCount > 1 ? Math.ceil(Math.log2(playoffTeamCount)) : 0;

        const playoffGamesUsedForCosting =
            playoffRounds * playoffGamesPerRound;

        const { data: seasonData, error: seasonError } = await supabase
            .from("seasons")
            .insert([
                {
                    league_id: Number(id),
                    season_name: seasonName.trim(),
                    roster_setup_type: rosterSetupType,
                    num_teams: teamsCount,
                    expected_total_players: totalPlayers,

                    structure_type: structureType,
                    num_conferences:
                        structureType === "conferences_divisions"
                            ? conferenceCount
                            : 0,
                    num_divisions:
                        structureType === "divisions" ||
                        structureType === "conferences_divisions"
                            ? divisionCount
                            : 0,

                    regular_season_games: regularGames,
                    playoff_teams: playoffTeamCount,
                    playoff_qualification: playoffQualification,
                    playoff_series_type: playoffSeriesType,
                    playoff_games_per_round_for_costing: playoffGamesPerRound,
                    playoff_games: playoffGamesUsedForCosting,

                    estimated_exempt_players: exemptionEstimate,
                },
            ])
            .select()
            .single();

        if (seasonError || !seasonData) {
            setSaving(false);
            alert(seasonError?.message || "There was a problem creating the season.");
            return;
        }

        const seasonId = seasonData.id;

        const baseSlots = Math.floor(totalPlayers / teamsCount);
        const remainder = totalPlayers % teamsCount;

        const teamsToInsert = [];

        for (let i = 0; i < teamsCount; i++) {
            const slots = i < remainder ? baseSlots + 1 : baseSlots;

            teamsToInsert.push({
                league_id: Number(id),
                season_id: Number(seasonId),
                team_name: `Team ${i + 1}`,
                team_color: "",
                target_roster_slots: slots,
            });
        }

        const { error: teamError } = await supabase.from("teams").insert(teamsToInsert);

        setSaving(false);

        if (teamError) {
            alert("Season created, but there was a problem creating teams.");
            router.push(`/leagues/${id}/seasons/${seasonId}`);
            return;
        }

        router.push(`/leagues/${id}/seasons/${seasonId}/finance`);
    };

    return (
        <main className="mx-auto max-w-4xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Add Season</h1>
                <p className="mt-2 text-gray-600">
                    Set the league structure, schedule framework, playoff format, and roster setup.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-8 rounded-xl border bg-white p-6 shadow-sm"
            >
                <section>
                    <h2 className="text-xl font-semibold">Season Basics</h2>

                    <div className="mt-5 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Season Name
                            </label>
                            <input
                                type="text"
                                value={seasonName}
                                onChange={(e) => setSeasonName(e.target.value)}
                                placeholder="Summer 2026"
                                required
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
                                placeholder="8"
                                min="1"
                                required
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Expected Total Players
                            </label>
                            <input
                                type="number"
                                value={expectedPlayers}
                                onChange={(e) => setExpectedPlayers(e.target.value)}
                                placeholder="96"
                                min="1"
                                required
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Estimated Exempt Players
                            </label>
                            <input
                                type="number"
                                value={estimatedExemptPlayers}
                                onChange={(e) => setEstimatedExemptPlayers(e.target.value)}
                                placeholder="0"
                                min="0"
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Optional estimate used later for pricing before actual player exemptions are finalized.
                            </p>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">League Structure</h2>

                    <div className="mt-5 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Structure Type
                            </label>
                            <select
                                value={structureType}
                                onChange={(e) =>
                                    handleStructureTypeChange(e.target.value as StructureType)
                                }
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            >
                                <option value="none">No divisions</option>
                                <option value="conferences_divisions">
                                    Conferences with divisions
                                </option>
                                <option value="divisions">Divisions only</option>
                            </select>
                        </div>

                        {structureType === "conferences_divisions" && (
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Number of Conferences
                                </label>
                                <input
                                    type="number"
                                    value={numConferences}
                                    onChange={(e) => setNumConferences(e.target.value)}
                                    placeholder="2"
                                    min="1"
                                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        )}

                        {(structureType === "divisions" ||
                            structureType === "conferences_divisions") && (
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Number of Divisions
                                </label>
                                <input
                                    type="number"
                                    value={numDivisions}
                                    onChange={(e) => setNumDivisions(e.target.value)}
                                    placeholder={
                                        structureType === "conferences_divisions" ? "4" : "2"
                                    }
                                    min="1"
                                    className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        )}
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">Schedule and Playoffs</h2>

                    <div className="mt-5 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Regular Season Games Per Team
                            </label>
                            <input
                                type="number"
                                value={regularSeasonGames}
                                onChange={(e) => setRegularSeasonGames(e.target.value)}
                                placeholder="10"
                                min="1"
                                required
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Number of Playoff Teams
                            </label>
                            <input
                                type="number"
                                value={playoffTeams}
                                onChange={(e) => setPlayoffTeams(e.target.value)}
                                placeholder="4"
                                min="0"
                                required
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Playoff Qualification
                            </label>
                            <select
                                value={playoffQualification}
                                onChange={(e) => setPlayoffQualification(e.target.value)}
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            >
                                {playoffQualificationOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Playoff Series Type
                            </label>
                            <select
                                value={playoffSeriesType}
                                onChange={(e) => {
                                    setPlayoffSeriesType(e.target.value);

                                    if (e.target.value === "single_elimination") {
                                        setPlayoffGamesPerRoundForCosting("1");
                                    }

                                    if (e.target.value === "best_of_3") {
                                        setPlayoffGamesPerRoundForCosting("3");
                                    }

                                    if (e.target.value === "best_of_5") {
                                        setPlayoffGamesPerRoundForCosting("5");
                                    }

                                    if (e.target.value === "best_of_7") {
                                        setPlayoffGamesPerRoundForCosting("7");
                                    }
                                }}
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            >
                                <option value="single_elimination">
                                    Single Game Elimination
                                </option>
                                <option value="best_of_3">Best of 3</option>
                                <option value="best_of_5">Best of 5</option>
                                <option value="best_of_7">Best of 7</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Games Used Per Playoff Round For Costing
                            </label>
                            <input
                                type="number"
                                value={playoffGamesPerRoundForCosting}
                                onChange={(e) =>
                                    setPlayoffGamesPerRoundForCosting(e.target.value)
                                }
                                placeholder="1"
                                min="1"
                                required
                                className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Use the worst-case game count. Example: best of 3 should usually use 3 games.
                            </p>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">Roster Setup Method</h2>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setRosterSetupType("manual")}
                            className={`rounded-xl border p-5 text-left ${
                                rosterSetupType === "manual"
                                    ? "border-black bg-gray-50"
                                    : "bg-white hover:bg-gray-50"
                            }`}
                        >
                            <h3 className="text-lg font-semibold">
                                Manual Teams & Rosters
                            </h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Best when teams are already known.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setRosterSetupType("draft")}
                            className={`rounded-xl border p-5 text-left ${
                                rosterSetupType === "draft"
                                    ? "border-black bg-gray-50"
                                    : "bg-white hover:bg-gray-50"
                            }`}
                        >
                            <h3 className="text-lg font-semibold">
                                Draft-Based League
                            </h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Best when players are drafted onto teams.
                            </p>
                        </button>
                    </div>
                </section>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Creating..." : "Create Season"}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="rounded-lg border px-6 py-3"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </main>
    );
}