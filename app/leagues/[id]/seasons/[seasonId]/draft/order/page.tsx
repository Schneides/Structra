"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Team = {
    id: number;
    team_name: string;
};

type DraftOrderRow = {
    id: number;
    league_id: number;
    season_id: number;
    team_id: number;
    draft_position: number;
};

export default function DraftOrderPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    const [teams, setTeams] = useState<Team[]>([]);
    const [draftOrder, setDraftOrder] = useState<number[]>([]);

    const [draftType, setDraftType] = useState("snake");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadData() {
            const { id, seasonId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);

            const { data: seasonData } = await supabase
                .from("seasons")
                .select("draft_type")
                .eq("id", Number(seasonId))
                .eq("league_id", Number(id))
                .single();

            if (seasonData?.draft_type) {
                setDraftType(seasonData.draft_type);
            }

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("team_name", { ascending: true });

            if (teamsError) {
                setError("There was a problem loading teams.");
                setLoading(false);
                return;
            }

            const loadedTeams = (teamsData ?? []) as Team[];
            setTeams(loadedTeams);

            const { data: orderData, error: orderError } = await supabase
                .from("draft_order")
                .select("*")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("draft_position", { ascending: true });

            if (orderError) {
                setError("There was a problem loading draft order.");
                setLoading(false);
                return;
            }

            const existingOrder = (orderData ?? []) as DraftOrderRow[];

            if (existingOrder.length > 0) {
                setDraftOrder(existingOrder.map((row) => row.team_id));
            } else {
                setDraftOrder(loadedTeams.map((team) => team.id));
            }

            setLoading(false);
        }

        loadData();
    }, [params]);

    const teamById = useMemo(() => {
        return new Map<number, Team>(
            teams.map((team) => [team.id, team])
        );
    }, [teams]);

    const moveTeam = (
        index: number,
        direction: "up" | "down"
    ) => {
        const newIndex =
            direction === "up"
                ? index - 1
                : index + 1;

        if (newIndex < 0 || newIndex >= draftOrder.length) {
            return;
        }

        setDraftOrder((current) => {
            const updated = [...current];

            const temp = updated[index];

            updated[index] = updated[newIndex];
            updated[newIndex] = temp;

            return updated;
        });
    };

    const randomizeOrder = () => {
        setDraftOrder((current) => {
            const shuffled = [...current];

            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(
                    Math.random() * (i + 1)
                );

                [shuffled[i], shuffled[j]] = [
                    shuffled[j],
                    shuffled[i],
                ];
            }

            return shuffled;
        });
    };

    const resetAlphabetical = () => {
        setDraftOrder(
            teams.map((team) => team.id)
        );
    };

    const saveDraftOrder = async () => {
        setSaving(true);
        setError("");

        const { error: seasonError } = await supabase
            .from("seasons")
            .update({
                draft_type: draftType,
            })
            .eq("id", Number(seasonId))
            .eq("league_id", Number(leagueId));

        if (seasonError) {
            setSaving(false);
            setError(
                "There was a problem saving the draft format."
            );
            return;
        }

        const { error: deleteError } = await supabase
            .from("draft_order")
            .delete()
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId));

        if (deleteError) {
            setSaving(false);
            setError(
                "There was a problem clearing the old draft order."
            );
            return;
        }

        const rowsToInsert = draftOrder.map(
            (teamId, index) => ({
                league_id: Number(leagueId),
                season_id: Number(seasonId),
                team_id: teamId,
                draft_position: index + 1,
                created_at: new Date().toISOString(),
            })
        );

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from("draft_order")
                .insert(rowsToInsert);

            if (insertError) {
                setSaving(false);

                setError(
                    `There was a problem saving draft order: ${insertError.message}`
                );

                return;
            }
        }

        setSaving(false);

        router.push(
            `/leagues/${leagueId}/seasons/${seasonId}/draft`
        );
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <p>Loading draft order...</p>
            </main>
        );
    }

    const snakePreview =
        draftType === "snake"
            ? [...draftOrder].reverse()
            : draftOrder;

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">
                        Set Draft Order
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Configure the draft format and team pick order.
                    </p>
                </div>

                <Link
                    href={`/leagues/${leagueId}/seasons/${seasonId}/draft`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center hover:bg-gray-50"
                >
                    Back to Draft
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
                    {error}
                </div>
            )}

            <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-2xl font-semibold">
                    Draft Format
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setDraftType("snake")}
                        className={`rounded-xl border p-5 text-left transition ${
                            draftType === "snake"
                                ? "border-black bg-black text-white"
                                : "hover:bg-gray-50"
                        }`}
                    >
                        <h3 className="text-xl font-semibold">
                            Snake Draft
                        </h3>

                        <p
                            className={`mt-2 text-sm ${
                                draftType === "snake"
                                    ? "text-gray-200"
                                    : "text-gray-600"
                            }`}
                        >
                            Draft order reverses every round.
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setDraftType("standard")}
                        className={`rounded-xl border p-5 text-left transition ${
                            draftType === "standard"
                                ? "border-black bg-black text-white"
                                : "hover:bg-gray-50"
                        }`}
                    >
                        <h3 className="text-xl font-semibold">
                            Standard Draft
                        </h3>

                        <p
                            className={`mt-2 text-sm ${
                                draftType === "standard"
                                    ? "text-gray-200"
                                    : "text-gray-600"
                            }`}
                        >
                            Same draft order every round.
                        </p>
                    </button>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={randomizeOrder}
                    className="rounded-lg border px-5 py-3 hover:bg-gray-50"
                >
                    Randomize Order
                </button>

                <button
                    type="button"
                    onClick={resetAlphabetical}
                    className="rounded-lg border px-5 py-3 hover:bg-gray-50"
                >
                    Reset Alphabetical
                </button>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-2xl font-semibold">
                    Round 1 Draft Order
                </h2>

                {draftOrder.length === 0 ? (
                    <p className="text-gray-600">
                        No teams available yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {draftOrder.map((teamId, index) => {
                            const team =
                                teamById.get(teamId);

                            return (
                                <div
                                    key={teamId}
                                    className="flex items-center justify-between rounded-xl border p-4"
                                >
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            Pick #{index + 1}
                                        </p>

                                        <h3 className="text-2xl font-semibold">
                                            {team?.team_name ||
                                                "Unknown Team"}
                                        </h3>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                moveTeam(
                                                    index,
                                                    "up"
                                                )
                                            }
                                            disabled={index === 0}
                                            className="rounded-lg border px-4 py-2 disabled:opacity-40"
                                        >
                                            Up
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                moveTeam(
                                                    index,
                                                    "down"
                                                )
                                            }
                                            disabled={
                                                index ===
                                                draftOrder.length -
                                                    1
                                            }
                                            className="rounded-lg border px-4 py-2 disabled:opacity-40"
                                        >
                                            Down
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {draftType === "snake" && draftOrder.length > 0 && (
                <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="mb-6 text-2xl font-semibold">
                        Round 2 Preview
                    </h2>

                    <div className="grid gap-3 md:grid-cols-2">
                        {snakePreview.map((teamId, index) => {
                            const team =
                                teamById.get(teamId);

                            return (
                                <div
                                    key={teamId}
                                    className="rounded-lg border p-4"
                                >
                                    <p className="text-sm text-gray-500">
                                        Pick #{index + 1}
                                    </p>

                                    <p className="mt-1 font-semibold">
                                        {team?.team_name}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={saveDraftOrder}
                    disabled={
                        saving ||
                        draftOrder.length === 0
                    }
                    className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                    {saving
                        ? "Saving..."
                        : "Save Draft Order"}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        router.push(
                            `/leagues/${leagueId}/seasons/${seasonId}/draft`
                        )
                    }
                    className="rounded-lg border px-6 py-3"
                >
                    Cancel
                </button>
            </div>
        </main>
    );
}