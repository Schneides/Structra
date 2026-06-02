"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";



export default function DeleteLeagueButton({ id }: { id: number }) {
    const router = useRouter();

    const handleDelete = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this league?"
        );

        if (!confirmed) return;

        const { error } = await supabase.from("leagues").delete().eq("id", id);

        if (error) {
            alert("There was a problem deleting the league.");
            return;
        }

        router.push("/dashboard");
        router.refresh();
    };

    return (
        <button
            onClick={handleDelete}
            className="inline-block rounded-lg border border-red-500 px-5 py-3 text-red-600"
        >
            Delete League
        </button>
    );
}