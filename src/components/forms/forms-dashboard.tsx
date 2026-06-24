/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Send,
  Loader2,
  Calendar,
  User,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getContacts } from "@/lib/actions/contacts";
import {
  getClientForms,
  getFormTemplates,
  sendFormToClient,
  syncDocuSealSubmissions,
  deleteFormTemplate,
} from "@/lib/actions/forms";
import { cn, getFullName } from "@/lib/utils";
import { format } from "date-fns";

export function FormsDashboard() {
  const [activeTab, setActiveTab] = useState<"sent" | "templates">("sent");
  const [clientForms, setClientForms] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Send Form Dialog State
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [sending, setSending] = useState(false);

  // Global Sync State
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [formsData, templatesData, contactsData] = await Promise.all([
          getClientForms(),
          getFormTemplates(),
          getContacts(),
        ]);
        setClientForms(formsData);
        setTemplates(templatesData);
        setContacts(contactsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await syncDocuSealSubmissions();
      // Reload forms
      const formsData = await getClientForms();
      setClientForms(formsData);
      alert(`Sync completed! Updated ${res.updated} forms.`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to sync forms: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendForm = async () => {
    if (!selectedContactId || !selectedTemplateId) return;
    setSending(true);
    try {
      await sendFormToClient(selectedContactId, selectedTemplateId);
      // Reload data
      const formsData = await getClientForms();
      setClientForms(formsData);
      setIsSendOpen(false);
      setSelectedContactId("");
      setSelectedTemplateId("");
      setContactSearch("");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to send form");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template? It will not delete already sent forms.")) return;
    try {
      await deleteFormTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete template: " + err.message);
    }
  };

  // Filtered Client Forms
  const filteredForms = clientForms.filter((form) => {
    const contact = form.contacts;
    const clientName = contact ? getFullName(contact.first_name, contact.last_name).toLowerCase() : "";
    const templateName = form.form_templates?.name?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = clientName.includes(query) || templateName.includes(query);
    const matchesStatus = statusFilter === "all" || form.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filtered Contacts for the Send Form Select dropdown
  const filteredContacts = contacts.filter((c) =>
    getFullName(c.first_name, c.last_name).toLowerCase().includes(contactSearch.toLowerCase())
  );

  // Statistics
  const stats = {
    sent: clientForms.filter((f) => f.status === "sent").length,
    received: clientForms.filter((f) => f.status === "received").length,
    completed: clientForms.filter((f) => f.status === "completed").length,
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DocuSeal Signatures</h1>
          <p className="text-muted-foreground mt-1">
            Create, send, and track custom liability waivers and gym contracts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncing}
            className="h-10 px-4 shadow-soft border-border/80"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            Sync Status
          </Button>

          <Button onClick={() => setIsSendOpen(true)} className="h-10 px-4 shadow-soft">
            <Plus className="h-4 w-4 mr-2" />
            Send Form
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Sent (Invited)", count: stats.sent, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Received (Viewed)", count: stats.received, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Completed (Signed)", count: stats.completed, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-soft">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-3xl font-bold mt-1">{s.count}</p>
              </div>
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <FileText className={cn("h-5 w-5", s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1 flex-wrap gap-4">
        <div className="flex items-center bg-muted/40 rounded-md p-1">
          <button
            onClick={() => setActiveTab("sent")}
            className={cn(
              "px-4 h-8 text-xs font-semibold rounded-[5px] transition-all",
              activeTab === "sent"
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sent Documents
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 h-8 text-xs font-semibold rounded-[5px] transition-all",
              activeTab === "templates"
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Form Templates ({templates.length})
          </button>
        </div>

        {activeTab === "sent" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-card border border-border/80 rounded-md focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        ) : (
          <Link href="/forms/templates">
            <Button size="sm" className="shadow-soft h-9 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Template
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          Loading DocuSeal database...
        </div>
      ) : activeTab === "sent" ? (
        <div className="space-y-2">
          {filteredForms.map((form) => {
            const clientName = form.contacts 
              ? getFullName(form.contacts.first_name, form.contacts.last_name) 
              : "Unknown Client";

            return (
              <Card key={form.id} className="border-border/60 hover:border-foreground/10 transition-colors shadow-soft">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {form.form_templates?.name || "Custom Contract"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Link href={`/clients/${form.contact_id}`} className="hover:text-foreground hover:underline flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {clientName}
                        </Link>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(form.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <Badge
                      variant={
                        form.status === "completed"
                          ? "success"
                          : form.status === "received"
                            ? "secondary"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {form.status === "received" ? "received (viewed)" : form.status}
                    </Badge>

                    {form.status === "completed" ? (
                      <Button asChild size="sm" variant="outline" className="h-9 text-xs shadow-soft">
                        <a href={`/api/forms/download/${form.id}`} download>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Download PDF
                        </a>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {form.signing_url && (
                          <Button asChild size="sm" variant="outline" className="h-9 text-xs shadow-soft">
                            <a href={form.signing_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Sign Link
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredForms.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center shadow-soft">
              <FolderLock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No signature requests found</p>
              <p className="text-xs text-muted-foreground mt-1">Select Send Form to deliver a document signature invite to a client.</p>
            </div>
          )}
        </div>
      ) : (
        /* Templates tab view */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="border-border/60 hover:border-foreground/10 transition-all shadow-soft flex flex-col justify-between h-[150px]">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{tmpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(tmpl.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    ID: {tmpl.docuseal_template_id}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-auto">
                  <span className="text-[10px] text-muted-foreground">
                    {(tmpl.fields as unknown[])?.length || 0} interactive elements
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteTemplate(tmpl.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center shadow-soft">
              <FolderLock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No templates saved yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create templates to easily sign waivers, contracts, and agreements.</p>
              <Link href="/forms/templates" className="inline-block mt-4">
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create First Template
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Send Form Dialog */}
      <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Send Signature Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Step 1: Select Contact */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Step 1: Select Client
              </Label>
              <Input
                placeholder="Search clients..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="h-9 text-xs mb-2"
              />
              <div className="max-h-[160px] overflow-y-auto border border-border/80 rounded-md p-1 bg-card divide-y divide-border/40">
                {filteredContacts.map((c) => {
                  const isSelected = selectedContactId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedContactId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors rounded-[4px] flex items-center justify-between",
                        isSelected 
                          ? "bg-primary text-primary-foreground font-semibold" 
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span>{getFullName(c.first_name, c.last_name)}</span>
                      <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        {c.email}
                      </span>
                    </button>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No clients match search</p>
                )}
              </div>
            </div>

            {/* Step 2: Select Template */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Step 2: Select Document Template
              </Label>
              <div className="grid gap-1.5 max-h-[160px] overflow-y-auto border border-border/80 rounded-md p-1.5 bg-card">
                {templates.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-xs transition-colors rounded-[4px] border border-border/40 flex items-center justify-between",
                        isSelected 
                          ? "border-primary bg-primary/10 text-primary font-semibold" 
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span className="truncate">{tmpl.name}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })}
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No templates available. Create one in templates tab.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 pt-3 mt-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1 mr-auto">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Will automatically email client to sign.
            </div>

            <Button
              disabled={sending || !selectedContactId || !selectedTemplateId}
              onClick={handleSendForm}
              className="shadow-soft"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Signature Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
