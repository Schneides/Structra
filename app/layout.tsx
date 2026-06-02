import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Structra",
  description: "Run your league without spreadsheets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav className="w-full border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-bold">
              Structra
            </Link>

            <div className="flex gap-4">
              <Link href="/" className="text-sm font-medium hover:underline">
                Home
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium hover:underline"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}