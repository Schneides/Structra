"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type DraftPlayer = {
    id: number;
    league_id: number;
    season_id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    position: string | null;
    jersey_number: number | null;
    drafted_team_id: number | null;
};

type Team = {
    id: number;
    team_name: string;
};

const POSITION_OPTIONS = ["C", "LW", "RW", "D", "G"];

function getStatusBadge(drafted: boolean) {
    if (drafted) {
        return (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                Drafted
            </span>
        );
    }

    return (
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Available
        </span>
    );
}

export default function DraftPlayerPoolPage({
    params,
}: {
    params: Promise<{ id: string; seasonId: string }>;
}) {
    const [leagueId, setLeagueId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    const [players, setPlayers] = useState<DraftPlayer[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [position, setPosition] = useState("C");
    const [jerseyNumber, setJerseyNumber] = useState("");

    useEffect(() => {
        async function loadData() {
            const { id, seasonId } = await params;

            setLeagueId(id);
            setSeasonId(seasonId);

            const { data: playersData, error: playersError } = await supabase
                .from("draft_players")
                .select("*")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("last_name", { ascending: true });

            const { data: teamsData, error: teamsError } = await supabase
                .from("teams")
                .select("id, team_name")
                .eq("league_id", Number(id))
                .eq("season_id", Number(seasonId))
                .order("team_name", { ascending: true });

            if (playersError || teamsError) {
                setError("There was a problem loading the draft player pool.");
                setLoading(false);
                return;
            }

            setPlayers((playersData ?? []) as DraftPlayer[]);
            setTeams((teamsData ?? []) as Team[]);

            setLoading(false);
        }

        loadData();
    }, [params]);

    const teamNameById = useMemo(() => {
        return new Map(teams.map((team) => [team.id, team.team_name]));
    }, [teams]);

    const filteredPlayers = useMemo(() => {
        return players.filter((player) => {
            const fullName =
                `${player.first_name ?? ""} ${player.last_name ?? ""}`.toLowerCase();

            return fullName.includes(search.toLowerCase());
        });
    }, [players, search]);

    const availablePlayers = filteredPlayers.filter(
        (player) => !player.drafted_team_id
    );

    const draftedPlayers = filteredPlayers.filter(
        (player) => player.drafted_team_id
    );

    const goalieCount = players.filter(
        (player) => player.position === "G"
    ).length;

    const skaterCount = players.filter(
        (player) => player.position !== "G"
    ).length;

    const addPlayer = async (e: React.FormEvent) => {
        e.preventDefault();

        setSaving(true);
        setError("");

        const { data, error: insertError } = await supabase
            .from("draft_players")
            .insert([
                {
                    league_id: Number(leagueId),
                    season_id: Number(seasonId),
                    first_name: firstName,
                    last_name: lastName,
                    email: email || null,
                    phone: phone || null,
                    position,
                    jersey_number:
                        jerseyNumber === "" ? null : Number(jerseyNumber),
                    drafted_team_id: null,
                },
            ])
            .select("*")
            .single();

        setSaving(false);

        if (insertError || !data) {
            setError("There was a problem adding this player.");
            return;
        }

        setPlayers((current) => [...current, data as DraftPlayer]);

        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setPosition("C");
        setJerseyNumber("");
    };

    const deletePlayer = async (player: DraftPlayer) => {
        if (player.drafted_team_id) {
            alert(
                "This player has already been drafted and cannot be deleted."
            );
            return;
        }

        const confirmed = confirm(
            "Delete this player from the draft pool?"
        );

        if (!confirmed) return;

        const { error: deleteError } = await supabase
            .from("draft_players")
            .delete()
            .eq("id", player.id)
            .eq("league_id", Number(leagueId))
            .eq("season_id", Number(seasonId));

        if (deleteError) {
            alert("There was a problem deleting this player.");
            return;
        }

        setPlayers((current) =>
            current.filter((item) => item.id !== player.id)
        );
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-6 py-10">
                <p>Loading draft player pool...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold">
                        Draft Player Pool
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Build the list of players available for the draft.
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        Players added here will become available on the live draft board.
                    </p>
                </div>

                <Link
                    href={`/leagues/${leagueId}/seasons/${seasonId}/draft`}
                    className="flex min-h-[48px] items-center justify-center rounded-lg border px-5 py-3 text-center"
                >
                    Back to Draft
                </Link>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-5">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">Total Players</p>
                    <p className="mt-2 text-2xl font-bold">
                        {players.length}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">Available</p>
                    <p className="mt-2 text-2xl font-bold">
                        {availablePlayers.length}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">Drafted</p>
                    <p className="mt-2 text-2xl font-bold">
                        {draftedPlayers.length}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">Skaters</p>
                    <p className="mt-2 text-2xl font-bold">
                        {skaterCount}
                    </p>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-sm text-gray-500">Goalies</p>
                    <p className="mt-2 text-2xl font-bold">
                        {goalieCount}
                    </p>
                </div>
            </div>

            <div className="mb-8 rounded-xl border bg-blue-50 p-5 text-sm text-blue-800">
                Recommended player pool size should exceed total roster spots
                to ensure a healthy draft experience and replacement options.
            </div>

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
                    {error}
                </div>
            )}

            <form
                onSubmit={addPlayer}
                className="mb-8 rounded-xl border bg-white p-6 shadow-sm"
            >
                <h2 className="mb-5 text-2xl font-semibold">
                    Add Draft Player
                </h2>

                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            First Name
                        </label>

                        <input
                            value={firstName}
                            onChange={(e) =>
                                setFirstName(e.target.value)
                            }
                            required
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Last Name
                        </label>

                        <input
                            value={lastName}
                            onChange={(e) =>
                                setLastName(e.target.value)
                            }
                            required
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Position
                        </label>

                        <select
                            value={position}
                            onChange={(e) =>
                                setPosition(e.target.value)
                            }
                            className="w-full rounded-lg border px-4 py-3"
                        >
                            {POSITION_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Jersey Number
                        </label>

                        <input
                            type="number"
                            value={jerseyNumber}
                            onChange={(e) =>
                                setJerseyNumber(e.target.value)
                            }
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Email
                        </label>

                        <input
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Phone
                        </label>

                        <input
                            value={phone}
                            onChange={(e) =>
                                setPhone(e.target.value)
                            }
                            className="w-full rounded-lg border px-4 py-3"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="mt-6 rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                    {saving ? "Adding..." : "Add Player"}
                </button>
            </form>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search players..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border px-5 py-4"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold">
                            Available Players
                        </h2>

                        <span className="text-sm text-gray-500">
                            {availablePlayers.length} available
                        </span>
                    </div>

                    <div className="space-y-3">
                        {availablePlayers.length === 0 ? (
                            <p className="text-gray-600">
                                No available players found.
                            </p>
                        ) : (
                            availablePlayers.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-xl border p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {player.first_name}{" "}
                                                {player.last_name}
                                            </p>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {player.position || "-"} •
                                                Jersey #
                                                {player.jersey_number ?? "-"}
                                            </p>
                                        </div>

                                        {getStatusBadge(false)}
                                    </div>

                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                deletePlayer(player)
                                            }
                                            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                                        >
                                            Delete Player
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold">
                            Drafted Players
                        </h2>

                        <span className="text-sm text-gray-500">
                            {draftedPlayers.length} drafted
                        </span>
                    </div>

                    <div className="space-y-3">
                        {draftedPlayers.length === 0 ? (
                            <p className="text-gray-600">
                                No drafted players yet.
                            </p>
                        ) : (
                            draftedPlayers.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-xl border p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {player.first_name}{" "}
                                                {player.last_name}
                                            </p>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {player.position || "-"} •
                                                Jersey #
                                                {player.jersey_number ?? "-"}
                                            </p>

                                            <p className="mt-2 text-sm text-gray-600">
                                                Drafted by{" "}
                                                {player.drafted_team_id
                                                    ? teamNameById.get(
                                                          player.drafted_team_id
                                                      ) || "Unknown Team"
                                                    : "Unknown Team"}
                                            </p>
                                        </div>

                                        {getStatusBadge(true)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}