import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendBulkEmails } from "@/lib/actions/email";

export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const names: string[] = Array.isArray(body.names) ? body.names : [];
    const subject: string = body.subject || "Test from Cooper Fitness CRM";
    const messageBody: string =
      body.body ||
      "Hey {{first_name}}!\n\nThis is a test bulk email from the new Zoho SMTP integration. If you're seeing this, everything is wired up correctly.\n\n— Cooper Fitness";

    if (names.length === 0) {
      return NextResponse.json({ error: "Provide a 'names' array in the body" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: allContacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .limit(50);

    const orClauses: string[] = [];
    for (const name of names) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) {
        orClauses.push(`first_name.ilike.%${parts[0]}%`);
        orClauses.push(`last_name.ilike.%${parts[0]}%`);
      } else {
        const first = parts[0];
        const last = parts[parts.length - 1];
        orClauses.push(`and(first_name.ilike.%${first}%,last_name.ilike.%${last}%)`);
        orClauses.push(`and(first_name.ilike.%${last}%,last_name.ilike.%${first}%)`);
        for (let i = 1; i < parts.length - 1; i++) {
          orClauses.push(`and(first_name.ilike.%${first}%,last_name.ilike.%${parts[i]}%)`);
          orClauses.push(`and(first_name.ilike.%${parts[i]}%,last_name.ilike.%${last}%)`);
        }
      }
    }

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .or(orClauses.join(","));

    if (error) {
      return NextResponse.json({ error: error.message, query: orClauses.join(",") }, { status: 500 });
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        {
          error: "No contacts matched",
          names,
          query: orClauses,
          allContacts: allContacts || [],
        },
        { status: 404 }
      );
    }

    const matched = contacts.map((c: any) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      email: c.email,
    }));

    const result = await sendBulkEmails(
      matched.map((c) => c.id),
      subject,
      messageBody
    );

    return NextResponse.json({
      matched,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
