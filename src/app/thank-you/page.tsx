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
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-6 py-14 text-[var(--foreground)]">
      <section className="w-full rounded-3xl border border-[var(--sand)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--ink-soft)]">Red & Jess</p>
        <h1 className="mt-2 text-4xl font-semibold text-[var(--ink-deep)]">Thank You</h1>
        <p className="mt-3 text-[var(--ink-soft)]">{statusLabel}</p>

        <div className="mt-6 rounded-2xl border border-[var(--sand)] bg-[var(--surface-2)] p-4">
          <p className="text-sm text-[var(--ink-soft)]">Name</p>
          <p className="font-medium text-[var(--ink-deep)]">{name}</p>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Invite Code</p>
          <p className="font-medium text-[var(--ink-deep)]">{inviteCode}</p>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Attendance</p>
          <p className="font-medium text-[var(--ink-deep)]">{attendance}</p>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">Guest Count</p>
          <p className="font-medium text-[var(--ink-deep)]">{guestCount}</p>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-[var(--foreground)] hover:bg-[var(--accent-hover)]"
        >
          Submit Another RSVP
        </Link>
      </section>
    </main>
  );
}
