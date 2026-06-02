"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Player = {
    id: number;
    league_id: number;
    season_id: number;
    team_id: number;
    first_name: string | null;
    last_name: string | null;
    amount_due: number | null;
    amount_paid: number | null;
    payment_status: string | null;
    payment_notes: string | null;
    payment_exemption_percent: number | null;
};

type Team = {
    id: number;
    team_name: string;
};

type PaymentsEditorProps = {
    leagueId: string;
    seasonId: string;
    leagueName: string;
    seasonName: string;
    initialPlayers: Player[];
    initialTeams: Team[];
    playersError: boolean;
    teamsError: boolean;
    initialSuggestedPlayerFee: number;
    lockedMode?: "tracker" | "exemptions";
};

const roundMoney = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number) =>
    roundMoney(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function StatusBadge({ status }: { status: string }) {
    if (status === "Exempt") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                Exempt
            </span>
        );
    }
    if (status === "Paid") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Paid
            </span>
        );
    }
    if (status === "Partial") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Partial
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Unpaid
        </span>
    );
}

function ExemptionBadge({ exemptionPercent }: { exemptionPercent: number }) {
    if (exemptionPercent >= 100) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                Full
            </span>
        );
    }
    if (exemptionPercent > 0) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                Partial
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
            None
        </span>
    );
}

export default function PaymentsEditor({
    leagueId,
    seasonId,
    leagueName,
    seasonName,
    initialPlayers,
    initialTeams,
    playersError,
    teamsError,
    initialSuggestedPlayerFee,
    lockedMode,
}: PaymentsEditorProps) {
    const [players, setPlayers] = useState<Player[]>(initialPlayers);
    const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
    const [editAmountPaid, setEditAmountPaid] = useState("");
    const [editPaymentNotes, setEditPaymentNotes] = useState("");
    const [editExemptionPercent, setEditExemptionPercent] = useState("");
    const [savingPlayerId, setSavingPlayerId] = useState<number | null>(null);
    const [savingExemptionsComplete, setSavingExemptionsComplete] = useState(false);

    const activeTab = lockedMode ?? "tracker";

    const totalLeagueCost = useMemo(() => {
        return roundMoney(initialSuggestedPlayerFee * players.length);
    }, [players, initialSuggestedPlayerFee]);

    const weightedPlayerCount = useMemo(() => {
        return players.reduce((sum, player) => {
            const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
            return sum + (1 - exemptionPercent / 100);
        }, 0);
    }, [players]);

    const redistributedBaseFee = useMemo(() => {
        if (weightedPlayerCount <= 0) return initialSuggestedPlayerFee;
        return roundMoney(totalLeagueCost / weightedPlayerCount);
    }, [totalLeagueCost, weightedPlayerCount, initialSuggestedPlayerFee]);

    const getPlayerDue = (player: Player) => {
        const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
        return roundMoney(redistributedBaseFee * (1 - exemptionPercent / 100));
    };

    const getPaymentStatus = (due: number, paid: number) => {
        if (paid <= 0) return "Unpaid";
        if (due > 0 && paid >= due) return "Paid";
        return "Partial";
    };

    const totalDue = useMemo(
        () => roundMoney(players.reduce((sum, player) => sum + getPlayerDue(player), 0)),
        [players, redistributedBaseFee]
    );

    const totalPaid = useMemo(
        () => roundMoney(players.reduce((sum, player) => sum + Number(player.amount_paid ?? 0), 0)),
        [players]
    );

    const totalOutstanding = roundMoney(totalDue - totalPaid);

    const teamSummaries = useMemo(() => {
        return initialTeams.map((team) => {
            const teamPlayers = players.filter((player) => player.team_id === team.id);
            const teamTotalDue = roundMoney(
                teamPlayers.reduce((sum, player) => sum + getPlayerDue(player), 0)
            );
            const teamTotalPaid = roundMoney(
                teamPlayers.reduce((sum, player) => sum + Number(player.amount_paid ?? 0), 0)
            );
            return {
                id: team.id,
                teamName: team.team_name,
                playerCount: teamPlayers.length,
                totalDue: teamTotalDue,
                totalPaid: teamTotalPaid,
                outstanding: roundMoney(teamTotalDue - teamTotalPaid),
                players: teamPlayers,
            };
        });
    }, [initialTeams, players, redistributedBaseFee]);

    const startEditingPayment = (player: Player) => {
        setEditingPlayerId(player.id);
        setEditAmountPaid(String(roundMoney(Number(player.amount_paid ?? 0))));
        setEditPaymentNotes(player.payment_notes ?? "");
    };

    const startEditingExemption = (player: Player) => {
        setEditingPlayerId(player.id);
        setEditExemptionPercent(String(Number(player.payment_exemption_percent ?? 0)));
    };

    const cancelEditing = () => {
        setEditingPlayerId(null);
        setEditAmountPaid("");
        setEditPaymentNotes("");
        setEditExemptionPercent("");
    };

    const savePayment = async (player: Player) => {
        const amountDue = getPlayerDue(player);
        const rawAmountPaid = editAmountPaid === "" ? 0 : Number(editAmountPaid);

        if (Number.isNaN(rawAmountPaid) || rawAmountPaid < 0) {
            alert("Amount Paid must be a valid number greater than or equal to 0.");
            return;
        }

        const amountPaid = roundMoney(rawAmountPaid);
        const paymentStatus = getPaymentStatus(amountDue, amountPaid);

        setSavingPlayerId(player.id);

        const { error } = await supabase
            .from("players")
            .update({
                amount_due: amountDue,
                amount_paid: amountPaid,
                payment_notes: editPaymentNotes,
                payment_status: paymentStatus,
            })
            .eq("id", player.id)
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId));

        setSavingPlayerId(null);

        if (error) {
            alert(error.message || "There was a problem saving the payment update.");
            return;
        }

        setPlayers((current) =>
            current.map((existing) =>
                existing.id === player.id
                    ? {
                          ...existing,
                          amount_due: amountDue,
                          amount_paid: amountPaid,
                          payment_notes: editPaymentNotes,
                          payment_status: paymentStatus,
                      }
                    : existing
            )
        );

        cancelEditing();
    };

    const saveExemption = async (player: Player) => {
        const exemptionPercent = Number(editExemptionPercent || 0);

        if (Number.isNaN(exemptionPercent) || exemptionPercent < 0 || exemptionPercent > 100) {
            alert("Exemption percent must be between 0 and 100.");
            return;
        }

        setSavingPlayerId(player.id);

        const { error } = await supabase
            .from("players")
            .update({ payment_exemption_percent: exemptionPercent })
            .eq("id", player.id)
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId));

        setSavingPlayerId(null);

        if (error) {
            alert(error.message || "There was a problem saving the exemption.");
            return;
        }

        setPlayers((current) =>
            current.map((existing) =>
                existing.id === player.id
                    ? { ...existing, payment_exemption_percent: exemptionPercent }
                    : existing
            )
        );

        cancelEditing();
    };

    const saveExemptionsComplete = async () => {
        setSavingExemptionsComplete(true);

        const { error } = await supabase
            .from("seasons")
            .update({ exemptions_completed_at: new Date().toISOString() })
            .eq("id", Number(seasonId))
            .eq("league_id", Number(leagueId));

        setSavingExemptionsComplete(false);

        if (error) {
            alert(error.message || "There was a problem saving exemptions.");
            return;
        }

        window.location.href = `/leagues/${leagueId}/seasons/${seasonId}`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="mx-auto max-w-6xl px-6 py-8">

                {/* Breadcrumb */}
                <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-400">
                    <Link href="/dashboard" className="transition-colors hover:text-gray-700">
                        Dashboard
                    </Link>
                    <span>/</span>
                    <Link href={`/leagues/${leagueId}`} className="transition-colors hover:text-gray-700">
                        {leagueName}
                    </Link>
                    <span>/</span>
                    <Link href={`/leagues/${leagueId}/seasons/${seasonId}`} className="transition-colors hover:text-gray-700">
                        {seasonName}
                    </Link>
                    <span>/</span>
                    <span className="font-medium text-gray-700">
                        {activeTab === "exemptions" ? "Exemptions" : "Payments"}
                    </span>
                </nav>

                {/* Header */}
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                            {activeTab === "exemptions" ? "Payment Exemptions" : "Season Payments"}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">{seasonName}</p>
                        <p className="mt-1 text-sm text-gray-400">
                            Player balances are based on the finalized season fee calculated in Finance.
                        </p>
                    </div>
                    <Link
                        href={`/leagues/${leagueId}/seasons/${seasonId}`}
                        className="shrink-0 rounded-lg border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                    >
                        Back to Season
                    </Link>
                </div>

                {/* Summary stats */}
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Base Player Fee
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">
                            ${formatCurrency(redistributedBaseFee)}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Total Due
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">
                            ${formatCurrency(totalDue)}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Total Paid
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">
                            ${formatCurrency(totalPaid)}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Outstanding
                        </p>
                        <p className={`mt-1.5 text-2xl font-bold tabular-nums ${totalOutstanding > 0.01 ? "text-red-600" : "text-gray-900"}`}>
                            ${formatCurrency(totalOutstanding)}
                        </p>
                    </div>
                </div>

                {/* Data errors */}
                {playersError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        There was a problem loading players.
                    </div>
                )}
                {teamsError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        There was a problem loading teams.
                    </div>
                )}

                {/* Exemptions mode */}
                {activeTab === "exemptions" && (
                    <section className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">
                                    Apply Exemptions
                                </h2>
                                <p className="mt-1.5 text-sm text-gray-500">
                                    Exemptions lower one player&apos;s balance and redistribute that cost across the rest of the paying players.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={saveExemptionsComplete}
                                disabled={savingExemptionsComplete}
                                className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
                            >
                                {savingExemptionsComplete ? "Saving..." : "Save Exemptions"}
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full">
                                <thead className="border-b bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        <th className="px-4 py-3">Player</th>
                                        <th className="px-4 py-3">Exemption</th>
                                        <th className="px-4 py-3">Exemption %</th>
                                        <th className="px-4 py-3">Amount Due</th>
                                        <th className="px-4 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((player) => {
                                        const isEditing = editingPlayerId === player.id;
                                        const exemptionPercent = Number(player.payment_exemption_percent ?? 0);

                                        return (
                                            <tr key={player.id} className="border-b text-sm last:border-0">
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    {player.first_name} {player.last_name}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ExemptionBadge exemptionPercent={exemptionPercent} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="1"
                                                            value={editExemptionPercent}
                                                            onChange={(e) => setEditExemptionPercent(e.target.value)}
                                                            className="w-28 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-700">{exemptionPercent}%</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    ${formatCurrency(getPlayerDue(player))}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => saveExemption(player)}
                                                                disabled={savingPlayerId === player.id}
                                                                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                                            >
                                                                {savingPlayerId === player.id ? "Saving..." : "Save"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditing}
                                                                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditingExemption(player)}
                                                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Tracker mode */}
                {activeTab === "tracker" && (
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                            Teams
                        </p>
                        <div className="space-y-4">
                            {teamSummaries.map((team) => (
                                <div key={team.id} className="rounded-xl border bg-white p-5 shadow-sm">
                                    <div className="mb-4">
                                        <h3 className="text-base font-semibold text-gray-900">
                                            {team.teamName}
                                        </h3>
                                        <p className="mt-0.5 text-xs text-gray-400">
                                            {team.playerCount} player{team.playerCount === 1 ? "" : "s"}
                                        </p>
                                    </div>

                                    {/* Team totals */}
                                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-lg border bg-gray-50 p-3">
                                            <p className="text-xs font-medium text-gray-400">Team Total Due</p>
                                            <p className="mt-1 text-base font-bold text-gray-900">
                                                ${formatCurrency(team.totalDue)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border bg-gray-50 p-3">
                                            <p className="text-xs font-medium text-gray-400">Team Total Paid</p>
                                            <p className="mt-1 text-base font-bold text-gray-900">
                                                ${formatCurrency(team.totalPaid)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border bg-gray-50 p-3">
                                            <p className="text-xs font-medium text-gray-400">Team Outstanding</p>
                                            <p className={`mt-1 text-base font-bold ${team.outstanding > 0.01 ? "text-red-600" : "text-gray-900"}`}>
                                                ${formatCurrency(team.outstanding)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Player table */}
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="min-w-full">
                                            <thead className="border-b bg-gray-50">
                                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                    <th className="px-4 py-3">Player</th>
                                                    <th className="px-4 py-3">Exemption</th>
                                                    <th className="px-4 py-3">Due</th>
                                                    <th className="px-4 py-3">Paid</th>
                                                    <th className="px-4 py-3">Balance</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Notes</th>
                                                    <th className="px-4 py-3">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {team.players.map((player) => {
                                                    const isEditing = editingPlayerId === player.id;
                                                    const amountDue = getPlayerDue(player);
                                                    const currentPaid = roundMoney(Number(player.amount_paid ?? 0));
                                                    const exemptionPercent = Number(player.payment_exemption_percent ?? 0);
                                                    const previewPaid = isEditing
                                                        ? roundMoney(Number(editAmountPaid || 0))
                                                        : currentPaid;
                                                    const remaining = roundMoney(amountDue - previewPaid);
                                                    const previewStatus =
                                                        exemptionPercent >= 100
                                                            ? "Exempt"
                                                            : isEditing
                                                            ? getPaymentStatus(amountDue, previewPaid)
                                                            : player.payment_status || "Unpaid";

                                                    return (
                                                        <tr key={player.id} className="border-b text-sm last:border-0">
                                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                                {player.first_name} {player.last_name}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <ExemptionBadge exemptionPercent={exemptionPercent} />
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-700">
                                                                ${formatCurrency(amountDue)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={editAmountPaid}
                                                                        onChange={(e) => setEditAmountPaid(e.target.value)}
                                                                        className="w-28 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-700">${formatCurrency(currentPaid)}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-700">
                                                                ${formatCurrency(remaining)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <StatusBadge status={previewStatus} />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editPaymentNotes}
                                                                        onChange={(e) => setEditPaymentNotes(e.target.value)}
                                                                        className="w-full min-w-[140px] rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-500">{player.payment_notes || "—"}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isEditing ? (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => savePayment(player)}
                                                                            disabled={savingPlayerId === player.id}
                                                                            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                                                        >
                                                                            {savingPlayerId === player.id ? "Saving..." : "Save"}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelEditing}
                                                                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEditingPayment(player)}
                                                                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
