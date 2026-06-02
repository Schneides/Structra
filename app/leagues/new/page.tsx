"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";


export default function NewLeaguePage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        leagueName: "",
        sport: "Hockey",
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const { error } = await supabase.from("leagues").insert([
    {
      league_name: formData.leagueName,
      sport: formData.sport,
    },
  ]);

  if (error) {
    alert("There was a problem creating the league.");
    return;
  }

  router.push("/dashboard");
};

    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Create League</h1>
                <p className="mt-2 text-gray-600">
                    Create a league in Structra to get started.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
            >
                <div>
                    <label className="mb-2 block text-sm font-medium">League Name</label>
                    <input
                        name="leagueName"
                        type="text"
                        value={formData.leagueName}
                        onChange={handleChange}
                        placeholder="Hoboken Spring Hockey League"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Sport</label>
                    <select
                        name="sport"
                        value={formData.sport}
                        onChange={handleChange}
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
                        className="rounded-lg bg-black px-6 py-3 text-white"
                    >
                        Create League
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