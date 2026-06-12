import { notFound } from "next/navigation";
import { getContactById } from "@/lib/actions/contacts";
import { getNotesByContactId } from "@/lib/actions/notes";
import { getClientChecklists } from "@/lib/actions/checklists";
import { getFollowUps } from "@/lib/actions/follow-ups";
import { ContactDetailView } from "@/components/clients/contact-detail-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let contact;
  let notes;
  let checklists;
  let followUps;

  try {
    contact = await getContactById(id);
    notes = await getNotesByContactId(id);
    checklists = await getClientChecklists(id);
    const allFollowUps = await getFollowUps();
    followUps = allFollowUps.filter((fu: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => fu.contact_id === id);
  } catch {
    notFound();
  }

  return (
    <ContactDetailView
      contact={contact}
      notes={notes}
      checklists={checklists}
      followUps={followUps}
    />
  );
}
