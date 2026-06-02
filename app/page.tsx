import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Structra
        </h1>
        <p className="mt-4 max-w-md text-lg text-gray-500">
          Run your league without spreadsheets.
        </p>
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-black px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>

      {/* How it works strip */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-8 py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Step 1
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              Set up your season
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              Configure teams, player fees, playoff structure, and billing model before the season begins.
            </p>
          </div>
          <div className="px-8 py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Step 2
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              Draft or build rosters
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              Run a live captain draft or assign players manually. Track exemptions and finalize player balances.
            </p>
          </div>
          <div className="px-8 py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Step 3
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              Track everything
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              Manage the schedule, collect payments, enter game stats, and watch standings update automatically.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
