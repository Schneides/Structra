import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <h1 className="mb-4 text-4xl font-bold">Structra</h1>

      <p className="mb-6 max-w-xl text-lg text-gray-600">
        Run your league without spreadsheets.
      </p>

      <div className="space-x-4">
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-black px-6 py-3 text-white"
        >
          Get Started
        </Link>

        <button className="rounded-lg border border-black px-6 py-3">
          Learn More
        </button>
      </div>
    </main>
  );
}