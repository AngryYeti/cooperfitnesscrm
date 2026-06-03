import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { NewEventProvider } from "@/components/calendar/new-event-provider";
import { CalendarRefreshProvider } from "@/components/calendar/refresh-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <CalendarRefreshProvider>
        <NewEventProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto">
              {children}
            </main>
          </div>
        </NewEventProvider>
      </CalendarRefreshProvider>
    </div>
  );
}
