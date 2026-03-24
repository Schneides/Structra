export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-center px-6">
      <h1 className="text-4xl font-bold mb-4">
        Structra
      </h1>

      <p className="text-lg text-gray-600 max-w-xl mb-6">
        Run your league without spreadsheets.
      </p>

      <div className="space-x-4">
        <button className="bg-black text-white px-6 py-3 rounded-lg">
          Get Started
        </button>

        <button className="border border-black px-6 py-3 rounded-lg">
          Learn More
        </button>
      </div>
    </main>
  );
}