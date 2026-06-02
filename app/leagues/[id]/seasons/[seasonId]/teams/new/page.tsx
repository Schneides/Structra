"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";


export default function NewSeasonTeamPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const router = useRouter();
    const [teamName, setTeamName] = useState("");
    const [teamColor, setTeamColor] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const { id, seasonId } = await params;

            const { error: insertError } = await supabase
                .from("teams")
                .insert([
                    {
                        league_id: Number(id),
                        season_id: Number(seasonId),
                        team_name: teamName,
                        team_color: teamColor,
                    },
                ]);

            if (insertError) {
                setError("There was a problem creating the team.");
                return;
            }

            router.push(`/leagues/${id}/seasons/${seasonId}/teams`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Add Team</h1>
                <p className="mt-2 text-gray-600">
                Create a team for this season. Captains can be assigned later from the roster.
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
                    <label className="mb-2 block text-sm font-medium">Team Name</label>
                    <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Blue Wolves"
                        required
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Team Color</label>
                    <input
                        type="text"
                        value={teamColor}
                        onChange={(e) => setTeamColor(e.target.value)}
                        placeholder="Blue"
                        required
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Create Team"}
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