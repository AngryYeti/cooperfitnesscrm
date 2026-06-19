import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { IdleTimer } from "@/components/auth/idle-timer";

const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fontHeading = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cooper Fitness CRM",
  description: "Client management for Cooper Fitness Coaching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontHeading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <IdleTimer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
