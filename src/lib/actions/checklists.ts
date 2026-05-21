"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ChecklistTemplate, ClientChecklist } from "@/lib/types";

export async function getChecklistTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_templates").select("*");
  if (error) throw new Error(error.message);
  return (data as ChecklistTemplate[]) || [];
}

export async function createChecklistTemplate(name: string, items: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ name, items })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return data as ChecklistTemplate;
}

export async function updateChecklistTemplate(id: string, name: string, items: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_templates")
    .update({ name, items })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteChecklistTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function getClientChecklists(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_checklists")
    .select("*")
    .eq("contact_id", contactId);
  if (error) throw new Error(error.message);
  return (data as ClientChecklist[]) || [];
}

export async function assignChecklist(contactId: string, templateId: string) {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("items")
    .eq("id", templateId)
    .single();

  if (!template) throw new Error("Template not found");

  const checklistItems = (template.items as string[]).map((label) => ({
    label,
    completed: false,
    completed_at: null,
  }));

  const { data, error } = await supabase
    .from("client_checklists")
    .insert({
      contact_id: contactId,
      template_id: templateId,
      items: checklistItems,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${contactId}`);
  return data as ClientChecklist;
}

export async function toggleChecklistItem(
  checklistId: string,
  itemIndex: number,
  completed: boolean,
  contactId: string
) {
  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from("client_checklists")
    .select("items")
    .eq("id", checklistId)
    .single();

  if (!checklist) throw new Error("Checklist not found");

  const items = checklist.items as Array<{
    label: string;
    completed: boolean;
    completed_at: string | null;
  }>;

  items[itemIndex] = {
    ...items[itemIndex],
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("client_checklists")
    .update({ items })
    .eq("id", checklistId);

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${contactId}`);
}
