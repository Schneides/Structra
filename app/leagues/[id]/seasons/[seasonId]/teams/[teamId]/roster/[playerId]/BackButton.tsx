"use client";

import { useRouter } from "next/navigation";


export default function BackButton() {
    const router = useRouter();

    return (
        <button
            type="button"
            onClick={() => router.back()}
            className="inline-block rounded-lg border px-5 py-3"
        >
            Back
        </button>
    );
}