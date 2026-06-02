"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function NewSeasonPlayerPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string; teamId: string }>;
}) {
    const router = useRouter();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [jerseyNumber, setJerseyNumber] = useState("");
    const [position, setPosition] = useState("");
    const [leadershipRole, setLeadershipRole] = useState("none");
    const [exemptionPercent, setExemptionPercent] = useState("0");

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const getPaymentStatus = (due: number, paid: number) => {
        if (paid <= 0) return "Unpaid";
        if (due > 0 && paid >= due) return "Paid";
        return "Partial";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const { id, seasonId, teamId } = await params;

            const { data: season, error: seasonError } = await supabase
                .from("seasons")
                .select("suggested_player_fee")
                .eq("id", Number(seasonId))
                .eq("league_id", Number(id))
                .single();

            if (seasonError || !season) {
                setError("Could not load season finance data.");
                setSaving(false);
                return;
            }

            const basePlayerFee = Number(season.suggested_player_fee ?? 0);
            const numericExemptionPercent = exemptionPercent
                ? Number(exemptionPercent)
                : 0;

            if (
                Number.isNaN(numericExemptionPercent) ||
                numericExemptionPercent < 0 ||
                numericExemptionPercent > 100
            ) {
                setError("Payment exemption must be a number between 0 and 100.");
                setSaving(false);
                return;
            }

            const amountDue = Math.round(
                basePlayerFee * (1 - numericExemptionPercent / 100)
            );
            const amountPaid = 0;
            const paymentStatus = getPaymentStatus(amountDue, amountPaid);

            const { error: insertError } = await supabase.from("players").insert([
                {
                    league_id: Number(id),
                    season_id: Number(seasonId),
                    team_id: Number(teamId),
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    phone,
                    jersey_number: jerseyNumber ? Number(jerseyNumber) : null,
                    position,
                    leadership_role: leadershipRole,
                    payment_exemption_percent: numericExemptionPercent,
                    amount_due: amountDue,
                    amount_paid: amountPaid,
                    payment_status: paymentStatus,
                    payment_notes: "",
                },
            ]);

            if (insertError) {
                setError("There was a problem creating the player.");
                setSaving(false);
                return;
            }

            router.push(`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Add Player</h1>
                <p className="mt-2 text-gray-600">
                    Add a player to this season roster.
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
                    <label className="mb-2 block text-sm font-medium">First Name</label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Joe"
                        required
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Last Name</label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Schneider"
                        required
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="joe@example.com"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Phone</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="555-123-4567"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Jersey Number</label>
                    <input
                        type="number"
                        value={jerseyNumber}
                        onChange={(e) => setJerseyNumber(e.target.value)}
                        placeholder="12"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Position</label>
                    <input
                        type="text"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Forward"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Leadership Role</label>
                    <select
                        value={leadershipRole}
                        onChange={(e) => setLeadershipRole(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    >
                        <option value="none">None</option>
                        <option value="captain">Captain</option>
                        <option value="alternate">Alternate Captain</option>
                    </select>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Payment Exemption (%)
                    </label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={exemptionPercent}
                        onChange={(e) => setExemptionPercent(e.target.value)}
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                        0 = full payment, 50 = half payment, 100 = fully exempt
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Create Player"}
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            const { id, seasonId, teamId } = await params;
                            router.push(`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster`);
                        }}
                        className="rounded-lg border px-6 py-3"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </main>
    );
}