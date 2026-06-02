"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function DeleteSeasonPlayerButton({
  leagueId,
  seasonId,
  teamId,
  playerId,
}: {
  leagueId: number;
  seasonId: number;
  teamId: number;
  playerId: number;
}) {
  const router = useRouter();

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this player?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("team_id", teamId);

    if (error) {
      alert("There was a problem deleting the player.");
      return;
    }

    router.push(
      `/leagues/${leagueId}/seasons/${seasonId}/teams/${teamId}/roster`
    );
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      className="inline-block rounded-lg border border-red-500 px-5 py-3 text-red-600"
    >
      Delete Player
    </button>
  );
}