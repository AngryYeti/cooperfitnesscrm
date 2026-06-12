import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFullName } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .order("first_name", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    count: contacts?.length || 0,
    contacts: (contacts || []).map((c: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => ({
      id: c.id,
      name: getFullName(c.first_name, c.last_name),
      email: c.email,
    })),
  });
}
