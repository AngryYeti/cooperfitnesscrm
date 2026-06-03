"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Variant = "compact" | "hero";

export function SearchInput(props: { variant?: Variant; className?: string }) {
  return (
    <Suspense fallback={<SearchInputFallback {...props} />}>
      <SearchInputInner {...props} />
    </Suspense>
  );
}

function SearchInputFallback({ variant = "compact", className }: { variant?: Variant; className?: string }) {
  const isHero = variant === "hero";
  return (
    <div className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          isHero ? "left-4 h-4 w-4" : "left-3.5 h-3.5 w-3.5"
        )}
      />
      <Input
        type="search"
        disabled
        placeholder={isHero ? "Search clients, programs..." : "Search clients, events..."}
        className={cn(
          "rounded-full bg-card border-border/60",
          isHero ? "h-11 pl-11 text-sm" : "h-9 pl-9 text-sm"
        )}
      />
    </div>
  );
}

function SearchInputInner({
  variant = "compact",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");

  useEffect(() => {
    if (pathname !== "/search") {
      setValue("");
    } else {
      setValue(searchParams.get("q") || "");
    }
  }, [pathname, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const isHero = variant === "hero";

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          isHero ? "left-4 h-4 w-4" : "left-3.5 h-3.5 w-3.5"
        )}
      />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isHero ? "Search clients, programs..." : "Search clients, events..."}
        className={cn(
          "rounded-full bg-card border-border/60 focus-visible:bg-card",
          isHero
            ? "h-11 pl-11 text-sm"
            : "h-9 pl-9 text-sm"
        )}
      />
    </form>
  );
}
