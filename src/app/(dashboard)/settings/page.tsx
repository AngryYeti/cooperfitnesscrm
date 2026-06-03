"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ListChecks, Pencil, KeyRound } from "lucide-react";
import {
  getChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/lib/actions/checklists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateItems, setNewTemplateItems] = useState<string[]>([""]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<string[]>([]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChecklistTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateTemplate = async () => {
    const items = newTemplateItems.filter((i) => i.trim() !== "");
    if (!newTemplateName.trim() || items.length === 0) return;

    await createChecklistTemplate(newTemplateName.trim(), items);
    setNewTemplateName("");
    setNewTemplateItems([""]);
    setIsCreateOpen(false);
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteChecklistTemplate(id);
    fetchTemplates();
  };

  const openEdit = (template: any) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditItems([...(template.items as string[])]);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const items = editItems.filter((i) => i.trim() !== "");
    if (!editName.trim() || items.length === 0) return;
    await updateChecklistTemplate(editingTemplate.id, editName.trim(), items);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const addEditItemField = () => setEditItems([...editItems, ""]);

  const updateEditItemField = (index: number, value: string) => {
    const items = [...editItems];
    items[index] = value;
    setEditItems(items);
  };

  const removeEditItemField = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const addItemField = () => setNewTemplateItems([...newTemplateItems, ""]);

  const updateItemField = (index: number, value: string) => {
    const items = [...newTemplateItems];
    items[index] = value;
    setNewTemplateItems(items);
  };

  const removeItemField = (index: number) => {
    setNewTemplateItems(newTemplateItems.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your workflow templates and preferences
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              Checklist Templates
            </CardTitle>
            <CardDescription>
              Create reusable workflow checklists for your clients
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="shadow-soft">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">No templates yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="mt-3"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create your first template
              </Button>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="rounded-lg border border-border/60 p-4 hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{template.name}</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(template)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {(template.items as string[]).map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-center gap-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Environment Setup
          </CardTitle>
          <CardDescription>
            Make sure these environment variables are configured for Vercel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="block rounded-md bg-muted/60 border border-border/40 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ZOHO_SMTP_HOST=smtp.zohocloud.ca
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USER=your-zoho-email
ZOHO_SMTP_PASSWORD=your-zoho-app-password
EMAIL_FROM="Cooper Fitness <noreply@cooper.fitness>"
CRON_SECRET=any-random-secret-string
DOCUSEAL_API_TOKEN=your-docuseal-token
DOCUSEAL_API_URL=https://api.docuseal.co`}
          </pre>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Checklist Template</DialogTitle>
            <DialogDescription>
              Build a reusable workflow your clients can follow
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. New Client Onboarding"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Checklist Items</Label>
              <div className="space-y-2">
                {newTemplateItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Item ${index + 1}`}
                      value={item}
                      onChange={(e) => updateItemField(index, e.target.value)}
                    />
                    {newTemplateItems.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItemField(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItemField}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateTemplate}
                disabled={
                  !newTemplateName.trim() ||
                  newTemplateItems.filter((i) => i.trim()).length === 0
                }
              >
                Create Template
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingTemplate}
        onOpenChange={(o) => !o && setEditingTemplate(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Checklist Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. New Client Onboarding"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Checklist Items</Label>
              <div className="space-y-2">
                {editItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Item ${index + 1}`}
                      value={item}
                      onChange={(e) => updateEditItemField(index, e.target.value)}
                    />
                    {editItems.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeEditItemField(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEditItemField}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={handleUpdateTemplate}
                disabled={
                  !editName.trim() ||
                  editItems.filter((i) => i.trim()).length === 0
                }
              >
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
