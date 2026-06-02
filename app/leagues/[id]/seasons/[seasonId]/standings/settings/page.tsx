"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function StandingsSettingsPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [pointsRegulationWin, setPointsRegulationWin] = useState("2");
    const [pointsRegulationLoss, setPointsRegulationLoss] = useState("0");
    const [pointsTie, setPointsTie] = useState("1");
    const [pointsOvertimeWin, setPointsOvertimeWin] = useState("2");
    const [pointsOvertimeLoss, setPointsOvertimeLoss] = useState("1");

    useEffect(() => {
        async function loadSeasonSettings() {
            const { id, seasonId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);

            const { data: season, error } = await supabase
                .from("seasons")
                .select(`
                    points_regulation_win,
                    points_regulation_loss,
                    points_tie,
                    points_overtime_win,
                    points_overtime_loss
                `)
                .eq("id", Number(seasonId))
                .eq("league_id", Number(id))
                .single();

            if (error || !season) {
                setError("Could not load standings settings.");
                setLoading(false);
                return;
            }

            setPointsRegulationWin(String(season.points_regulation_win ?? 2));
            setPointsRegulationLoss(String(season.points_regulation_loss ?? 0));
            setPointsTie(String(season.points_tie ?? 1));
            setPointsOvertimeWin(String(season.points_overtime_win ?? 2));
            setPointsOvertimeLoss(String(season.points_overtime_loss ?? 1));

            setLoading(false);
        }

        loadSeasonSettings();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const { error: updateError } = await supabase
                .from("seasons")
                .update({
                    points_regulation_win: Number(pointsRegulationWin),
                    points_regulation_loss: Number(pointsRegulationLoss),
                    points_tie: Number(pointsTie),
                    points_overtime_win: Number(pointsOvertimeWin),
                    points_overtime_loss: Number(pointsOvertimeLoss),
                })
                .eq("id", Number(seasonId))
                .eq("league_id", Number(leagueId));

            if (updateError) {
                setError("There was a problem saving standings settings.");
                return;
            }

            router.push(`/leagues/${leagueId}/seasons/${seasonId}/standings`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <p>Loading standings settings...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Standings Settings</h1>
                <p className="mt-2 text-gray-600">
                    Customize how points are awarded for this season.
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

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Regulation Win Points
                    </label>
                    <input
                        type="number"
                        value={pointsRegulationWin}
                        onChange={(e) => setPointsRegulationWin(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Regulation Loss Points
                    </label>
                    <input
                        type="number"
                        value={pointsRegulationLoss}
                        onChange={(e) => setPointsRegulationLoss(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Tie Points
                    </label>
                    <input
                        type="number"
                        value={pointsTie}
                        onChange={(e) => setPointsTie(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Overtime / Shootout Win Points
                    </label>
                    <input
                        type="number"
                        value={pointsOvertimeWin}
                        onChange={(e) => setPointsOvertimeWin(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Overtime / Shootout Loss Points
                    </label>
                    <input
                        type="number"
                        value={pointsOvertimeLoss}
                        onChange={(e) => setPointsOvertimeLoss(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Settings"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(`/leagues/${leagueId}/seasons/${seasonId}/standings`)
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