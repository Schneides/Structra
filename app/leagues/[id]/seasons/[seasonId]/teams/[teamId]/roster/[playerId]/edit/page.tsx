"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function EditSeasonPlayerPage({
  params,
}: {
  params: Promise<{
    id: string;
    seasonId: string;
    teamId: string;
    playerId: string;
  }>;
}) {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");
  const [leadershipRole, setLeadershipRole] = useState("none");

  const [exemptionPercent, setExemptionPercent] = useState("0");

  const [amountDue, setAmountDue] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    async function loadPlayer() {
      const { id, seasonId, teamId, playerId } = await params;

      setLeagueId(id);
      setSeasonId(seasonId);
      setTeamId(teamId);
      setPlayerId(playerId);

      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .eq("league_id", id)
        .eq("season_id", seasonId)
        .eq("team_id", teamId)
        .single();

      if (error || !data) {
        alert("Could not load player.");
        router.push(`/leagues/${id}/seasons/${seasonId}/teams/${teamId}/roster`);
        return;
      }

      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
      setJerseyNumber(
        data.jersey_number !== null && data.jersey_number !== undefined
          ? String(data.jersey_number)
          : ""
      );
      setPosition(data.position ?? "");
      setLeadershipRole(data.leadership_role ?? "none");

      setExemptionPercent(
        data.payment_exemption_percent !== null &&
          data.payment_exemption_percent !== undefined
          ? String(data.payment_exemption_percent)
          : "0"
      );

      setAmountDue(
        data.amount_due !== null && data.amount_due !== undefined
          ? String(data.amount_due)
          : "0"
      );

      setAmountPaid(
        data.amount_paid !== null && data.amount_paid !== undefined
          ? String(data.amount_paid)
          : "0"
      );

      setPaymentNotes(data.payment_notes ?? "");

      setLoading(false);
    }

    loadPlayer();
  }, [params, router]);

  const getPaymentStatus = (due: number, paid: number) => {
    if (paid <= 0) return "Unpaid";
    if (due > 0 && paid >= due) return "Paid";
    return "Partial";
  };

  const remainingBalance =
    (amountDue ? Number(amountDue) : 0) - (amountPaid ? Number(amountPaid) : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const numericAmountPaid = amountPaid ? Number(amountPaid) : 0;
    const numericExemptionPercent = exemptionPercent ? Number(exemptionPercent) : 0;

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("suggested_player_fee")
      .eq("id", Number(seasonId))
      .eq("league_id", Number(leagueId))
      .single();

    if (seasonError || !season) {
      setSubmitting(false);
      alert("Could not load season finance data.");
      return;
    }

    const basePlayerFee = Number(season.suggested_player_fee ?? 0);
    const recalculatedAmountDue = Math.round(
      basePlayerFee * (1 - numericExemptionPercent / 100)
    );
    const calculatedPaymentStatus = getPaymentStatus(
      recalculatedAmountDue,
      numericAmountPaid
    );

    const { error } = await supabase
      .from("players")
      .update({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        jersey_number: jerseyNumber ? Number(jerseyNumber) : null,
        position,
        leadership_role: leadershipRole,
        payment_exemption_percent: numericExemptionPercent,
        amount_due: recalculatedAmountDue,
        amount_paid: numericAmountPaid,
        payment_status: calculatedPaymentStatus,
        payment_notes: paymentNotes,
      })
      .eq("id", playerId)
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("team_id", teamId);

    setSubmitting(false);

    if (error) {
      alert("There was a problem updating the player.");
      return;
    }

    router.push(
      `/leagues/${leagueId}/seasons/${seasonId}/teams/${teamId}/roster`
    );
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this player?"
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("team_id", teamId);

    setDeleting(false);

    if (error) {
      alert("There was a problem deleting the player.");
      return;
    }

    router.push(`/leagues/${leagueId}/seasons/${seasonId}/teams/${teamId}/roster`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>Loading player...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Player</h1>
        <p className="mt-2 text-gray-600">
          Update this player for the current season.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Jersey Number</label>
          <input
            type="number"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Position</label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
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

        <div>
          <label className="mb-2 block text-sm font-medium">Amount Due</label>
          <input
            type="text"
            value={`$${Number(amountDue || 0).toLocaleString()}`}
            readOnly
            className="w-full rounded-lg border bg-gray-100 px-4 py-3 text-gray-700"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Amount Paid</label>
          <input
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Remaining Balance</label>
          <input
            type="text"
            value={`$${remainingBalance.toLocaleString()}`}
            readOnly
            className="w-full rounded-lg border bg-gray-100 px-4 py-3 text-gray-700"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Payment Status</label>
          <input
            type="text"
            value={getPaymentStatus(
              amountDue ? Number(amountDue) : 0,
              amountPaid ? Number(amountPaid) : 0
            )}
            readOnly
            className="w-full rounded-lg border bg-gray-100 px-4 py-3 text-gray-700"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Payment Notes</label>
          <textarea
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
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
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border px-6 py-3"
          >
            {deleting ? "Deleting..." : "Delete Player"}
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${leagueId}/seasons/${seasonId}/teams/${teamId}/roster`)
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