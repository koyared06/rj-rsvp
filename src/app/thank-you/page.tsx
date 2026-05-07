import Link from "next/link";

type SearchParams = {
  name?: string;
  code?: string;
  attendance?: "attending" | "declined" | string;
  guests?: string;
  status?: "submitted" | "updated" | string;
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const name = params.name ?? "Guest";
  const inviteCode = params.code ?? "-";
  const attendance = params.attendance ?? "-";
  const guestCount = params.guests ?? "-";
  const statusLabel =
    params.status === "updated" ? "Your RSVP was updated." : "Your RSVP was submitted.";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-6 py-14">
      <section className="w-full rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-[#6f5940]">Red & Jess</p>
        <h1 className="mt-2 text-4xl font-semibold">Thank You</h1>
        <p className="mt-3 text-zinc-700">{statusLabel}</p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-600">Name</p>
          <p className="font-medium">{name}</p>
          <p className="mt-3 text-sm text-zinc-600">Invite Code</p>
          <p className="font-medium">{inviteCode}</p>
          <p className="mt-3 text-sm text-zinc-600">Attendance</p>
          <p className="font-medium">{attendance}</p>
          <p className="mt-3 text-sm text-zinc-600">Guest Count</p>
          <p className="font-medium">{guestCount}</p>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700"
        >
          Submit Another RSVP
        </Link>
      </section>
    </main>
  );
}
