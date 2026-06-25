import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadCompletedForm } from "@/lib/actions/forms";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify Authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Form Details (to get filename and paths)
    const { data: form, error: dbError } = await supabase
      .from("client_forms")
      .select(`
        *,
        contacts (
          first_name,
          last_name
        ),
        form_templates (
          name
        )
      `)
      .eq("id", id)
      .single();

    if (dbError || !form) {
      return NextResponse.json({ error: "Form record not found" }, { status: 404 });
    }

    // 3. Ensure downloaded locally
    let relativePath = form.local_pdf_path;
    if (!relativePath || !fs.existsSync(path.join(process.cwd(), "public", relativePath))) {
      if (form.status === "completed") {
        relativePath = await downloadCompletedForm(id);
      } else {
        return NextResponse.json({ error: "Form is not completed yet" }, { status: 400 });
      }
    }

    const absolutePath = path.join(process.cwd(), "public", relativePath);
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    // 4. Read PDF file content
    const fileBuffer = fs.readFileSync(absolutePath);

    // 5. Create a clean filename
    const contact = form.contacts as { first_name: string; last_name: string };
    const template = form.form_templates as { name: string };
    const clientName = `${contact.first_name}_${contact.last_name}`.replace(/\s+/g, "_");
    const docName = template.name.replace(/\s+/g, "_");
    const cleanFilename = `${clientName}_${docName}.pdf`;

    // 6. Serve the PDF
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${cleanFilename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error("PDF download route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
