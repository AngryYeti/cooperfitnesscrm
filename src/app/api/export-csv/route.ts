import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .order("date_added", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "First Name",
    "Last Name",
    "Phone",
    "Email",
    "Fitness Goal",
    "Status",
    "Source",
    "Date Added",
    "Tags",
  ];

  const rows = (contacts || []).map((c) => [
    c.first_name,
    c.last_name,
    c.phone || "",
    c.email || "",
    c.fitness_goal || "",
    c.status,
    c.source || "",
    new Date(c.date_added).toLocaleDateString(),
    (c.tags || []).join(", "),
  ]);

  const csv = [headers, ...rows]
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cooper-fitness-contacts-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
