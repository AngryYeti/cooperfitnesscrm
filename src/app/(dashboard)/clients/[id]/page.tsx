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

  try {
    const contact = await getContactById(id);
    const notes = await getNotesByContactId(id);
    const checklists = await getClientChecklists(id);
    const allFollowUps = await getFollowUps();
    const followUps = allFollowUps.filter((fu: any) => fu.contact_id === id);

    return (
      <ContactDetailView
        contact={contact}
        notes={notes}
        checklists={checklists}
        followUps={followUps}
      />
    );
  } catch {
    notFound();
  }
}
