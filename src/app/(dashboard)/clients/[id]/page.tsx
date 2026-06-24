import { notFound } from "next/navigation";
import { getContactById } from "@/lib/actions/contacts";
import { getNotesByContactId } from "@/lib/actions/notes";
import { getClientChecklists } from "@/lib/actions/checklists";
import { getFollowUps } from "@/lib/actions/follow-ups";
import { getClientCommunications } from "@/lib/actions/communications";
import { getClientFormsByContactId } from "@/lib/actions/forms";
import { Contact, Note, ClientChecklist, Communication } from "@/lib/types";
import { ContactDetailView } from "@/components/clients/contact-detail-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let contact: Contact;
  let notes: Note[] = [];
  let checklists: ClientChecklist[] = [];
  let followUps: any[] = [];
  let communications: Communication[] = [];
  let forms: any[] = [];

  try {
    contact = await getContactById(id);
  } catch {
    notFound();
  }

  // Gracefully fetch other client details and fall back to empty arrays on failure
  try {
    notes = await getNotesByContactId(id);
  } catch (err) {
    console.error("Failed to fetch notes for contact", id, err);
    notes = [];
  }

  try {
    checklists = await getClientChecklists(id);
  } catch (err) {
    console.error("Failed to fetch checklists for contact", id, err);
    checklists = [];
  }

  try {
    const allFollowUps = await getFollowUps();
    followUps = allFollowUps.filter((fu: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => fu.contact_id === id);
  } catch (err) {
    console.error("Failed to fetch follow-ups for contact", id, err);
    followUps = [];
  }

  try {
    communications = await getClientCommunications(id);
  } catch (err) {
    console.error("Failed to fetch communications for contact", id, err);
    communications = [];
  }

  try {
    forms = await getClientFormsByContactId(id);
  } catch (err) {
    console.error("Failed to fetch forms for contact", id, err);
    forms = [];
  }

  return (
    <ContactDetailView
      contact={contact}
      notes={notes}
      checklists={checklists}
      followUps={followUps}
      communications={communications}
      forms={forms}
    />
  );
}
