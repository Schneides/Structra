"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { useState } from "react";


export default function DeleteSeasonTeamButton({
    leagueId,
    seasonId,
    teamId,
}: {
    leagueId: number;
    seasonId: number;
    teamId: number;
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleDelete = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this team?"
        );

        if (!confirmed) return;

        setIsLoading(true);

        const { error } = await supabase
            .from("teams")
            .delete()
            .eq("id", teamId)
            .eq("league_id", leagueId)
            .eq("season_id", seasonId);

        if (error) {
            alert("There was a problem deleting the team.");
            setIsLoading(false);
            return;
        }

        router.push(`/leagues/${leagueId}/seasons/${seasonId}/teams`);
        router.refresh();
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isLoading}
            className="inline-block rounded-lg border border-red-500 px-5 py-3 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? "Deleting..." : "Delete Team"}
        </button>
    );
}