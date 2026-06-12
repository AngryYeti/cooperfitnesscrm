import Link from "next/link";
import {
  Users,
  CalendarDays,
  CalendarClock,
  ArrowRight,
  Search as SearchIcon,
  Mail,
  Phone,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { globalSearch } from "@/lib/actions/search";
import { SearchInput } from "@/components/layout/search-input";
import { getFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const results = q ? await globalSearch(q) : null;

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search</h1>
          <p className="text-muted-foreground mt-1">
            {q
              ? `${results?.total ?? 0} result${(results?.total ?? 0) === 1 ? "" : "s"} for "${q}"`
              : "Find clients, calendar events, and follow-ups."}
          </p>
        </div>
        <SearchInput variant="hero" className="max-w-xl" />
      </section>

      {!q && (
        <div className="rounded-2xl bg-card border border-border/60 p-12 text-center shadow-soft">
          <div
            className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: "oklch(0.93 0.06 260)" }}
          >
            <SearchIcon
              className="h-5 w-5"
              style={{ color: "oklch(0.45 0.18 260)" }}
            />
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Try searching for a name, a goal like &quot;consult&quot; or &quot;weekly&quot;, or
            any event title.
          </p>
        </div>
      )}

      {q && results && results.total === 0 && (
        <div className="rounded-2xl bg-card border border-border/60 p-12 text-center shadow-soft">
          <p className="text-base font-medium">No results for &quot;{q}&quot;</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Try a shorter or different term. Searches match contacts by name,
            email, or phone, plus event and follow-up titles.
          </p>
        </div>
      )}

      {q && results && results.total > 0 && (
        <div className="space-y-6">
          {results.contacts.length > 0 && (
            <ResultGroup
              title="Clients"
              count={results.contacts.length}
              icon={Users}
            >
              {results.contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border/60 p-4 hover:border-foreground/20 transition-colors group"
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                    style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
                  >
                    {c.first_name[0]}
                    {c.last_name?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      {c.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                      <span className="font-medium text-foreground/70">
                        {c.status}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </ResultGroup>
          )}

          {results.events.length > 0 && (
            <ResultGroup
              title="Calendar Events"
              count={results.events.length}
              icon={CalendarDays}
            >
              {results.events.map((e) => {
                const contactName = e.contacts
                  ? getFullName(e.contacts.first_name, e.contacts.last_name)
                  : null;
                return (
                  <Link
                    key={e.id}
                    href={`/calendar?event=${e.id}`}
                    className="flex items-center gap-4 rounded-xl bg-card border border-border/60 p-4 hover:border-foreground/20 transition-colors group"
                  >
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: e.color || "oklch(0.55 0.2 260)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {e.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(e.start_time), "MMM d, yyyy 'at' h:mm a")}
                        {contactName && (
                          <>
                            {" "}
                            <span className="text-foreground/50">·</span>{" "}
                            {contactName}
                          </>
                        )}
                      </p>
                    </div>
                    {e.completed && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Done
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </ResultGroup>
          )}

          {results.followUps.length > 0 && (
            <ResultGroup
              title="Follow-Ups"
              count={results.followUps.length}
              icon={CalendarClock}
            >
              {results.followUps.map((f) => (
                <Link
                  key={f.id}
                  href={`/follow-ups`}
                  className="flex items-center gap-4 rounded-xl bg-card border border-border/60 p-4 hover:border-foreground/20 transition-colors group"
                >
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "oklch(0.93 0.06 75)" }}
                  >
                    <CalendarClock
                      className="h-4 w-4"
                      style={{ color: "oklch(0.5 0.15 75)" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.contact_name && (
                        <>
                          {f.contact_name}
                          <span className="text-foreground/50"> · </span>
                        </>
                      )}
                      Due {format(parseISO(f.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground/70">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
