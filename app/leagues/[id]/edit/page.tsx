"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import DeleteLeagueButton from "../DeleteLeagueButton";

export default function EditLeaguePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();

    const [leagueId, setLeagueId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [leagueName, setLeagueName] = useState("");
    const [sport, setSport] = useState("Hockey");

    useEffect(() => {
        async function loadLeague() {
            const { id } = await params;
            setLeagueId(id);

            const { data, error } = await supabase
                .from("leagues")
                .select("id, league_name, sport")
                .eq("id", id)
                .single();

            if (error || !data) {
                alert("Could not load league.");
                router.push("/dashboard");
                return;
            }

            setLeagueName(data.league_name ?? "");
            setSport(data.sport ?? "Hockey");
            setLoading(false);
        }

        loadLeague();
    }, [params, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        if (!leagueName.trim()) {
            setError("League name is required.");
            setSubmitting(false);
            return;
        }

        const { error } = await supabase
            .from("leagues")
            .update({
                league_name: leagueName.trim(),
                sport,
            })
            .eq("id", leagueId);

        setSubmitting(false);

        if (error) {
            setError("Could not update league. Please try again.");
            return;
        }

        router.push(`/leagues/${leagueId}`);
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <p>Loading league...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Edit League</h1>
                <p className="mt-2 text-gray-600">
                    Update league-level information. Season setup details are managed inside each season.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
            >
                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        League Name
                    </label>
                    <input
                        type="text"
                        required
                        value={leagueName}
                        onChange={(e) => setLeagueName(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Sport
                    </label>
                    <select
                        value={sport}
                        onChange={(e) => setSport(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    >
                        <option>Hockey</option>
                        <option>Soccer</option>
                        <option>Basketball</option>
                        <option>Softball</option>
                        <option>Volleyball</option>
                    </select>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {submitting ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push(`/leagues/${leagueId}`)}
                        disabled={submitting}
                        className="rounded-lg border px-6 py-3 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
                <h2 className="text-xl font-semibold text-red-700">
                    Danger Zone
                </h2>
                <p className="mt-2 text-sm text-red-600">
                    Delete this league only if you are sure you no longer need it.
                </p>

                <div className="mt-5">
                    <DeleteLeagueButton id={Number(leagueId)} />
                </div>
            </section>
        </main>
    );
}