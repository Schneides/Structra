"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { useState } from "react";

export default function DeleteSeasonButton({
  leagueId,
  seasonId,
}: {
  leagueId: number;
  seasonId: number;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this season? This will also remove its teams, players, games, and related data if your database relationships allow cascading deletes."
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("seasons")
      .delete()
      .eq("id", seasonId)
      .eq("league_id", leagueId);

    setDeleting(false);

    if (error) {
      alert("There was a problem deleting the season.");
      return;
    }

    router.push(`/leagues/${leagueId}/seasons`);
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-lg border px-5 py-3 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete Season"}
    </button>
  );
}