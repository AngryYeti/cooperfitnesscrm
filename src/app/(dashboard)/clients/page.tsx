"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Download,
  ArrowRightLeft,
  MoreHorizontal,
  Mail,
  Phone,
  Users as UsersIcon,
} from "lucide-react";
import { Contact, ContactStatus } from "@/lib/types";
import {
  getContacts,
  searchContacts,
  deleteContact,
  updateContact,
} from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactForm } from "@/components/forms/contact-form";

const statusOptions: ContactStatus[] = [
  "Lead",
  "Trial",
  "Active Client",
  "Completed",
];

const statusBadgeMap: Record<ContactStatus, "lead" | "trial" | "active" | "completed"> = {
  Lead: "lead",
  Trial: "trial",
  "Active Client": "active",
  Completed: "completed",
};

function ClientsPageInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as ContactStatus | undefined;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">(
    initialStatus || "all"
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContacts(
        statusFilter === "all" ? undefined : statusFilter
      );
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (searchQuery.trim()) {
        setLoading(true);
        try {
          const data = await searchContacts(searchQuery);
          setContacts(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        fetchContacts();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, fetchContacts]);

  const handleDelete = async () => {
    if (!deletingContact) return;
    await deleteContact(deletingContact.id);
    setDeletingContact(null);
    fetchContacts();
  };

  const handleStatusChange = async (contact: Contact, newStatus: ContactStatus) => {
    await updateContact(contact.id, { status: newStatus });
    fetchContacts();
  };

  const handleExportCSV = () => {
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
    const rows = contacts.map((c) => [
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
    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cooper-fitness-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients & Leads</h1>
          <p className="text-muted-foreground mt-1">
            Manage your contacts and clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="shadow-soft">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="shadow-soft">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-9 h-10 bg-muted/30 border-transparent focus-visible:bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ContactStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {searchQuery ? "No contacts found" : "No contacts yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Add your first contact to get started"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateOpen(true)} className="mt-4 shadow-soft">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/60">
                <tr>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left font-medium px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell text-muted-foreground text-xs uppercase tracking-wider">Goal</th>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                  <th className="text-right font-medium px-4 py-3 text-muted-foreground text-xs uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-soft flex items-center justify-center text-xs font-medium shrink-0">
                          {contact.first_name[0]}
                          {contact.last_name?.[0] || ""}
                        </div>
                        <Link
                          href={`/clients/${contact.id}`}
                          className="font-medium hover:underline decoration-foreground/30 underline-offset-2"
                        >
                          {contact.first_name} {contact.last_name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="text-muted-foreground text-xs space-y-0.5">
                        {contact.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[180px]">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </div>
                        )}
                        {!contact.email && !contact.phone && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {contact.fitness_goal || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeMap[contact.status]}>
                        {contact.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {contact.source || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => setEditingContact(contact)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(
                                contact,
                                contact.status === "Lead"
                                  ? "Active Client"
                                  : "Lead"
                              )
                            }
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Toggle status
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingContact(contact)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            onSuccess={() => {
              setIsCreateOpen(false);
              fetchContacts();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingContact}
        onOpenChange={(o) => !o && setEditingContact(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              contact={editingContact}
              onSuccess={() => {
                setEditingContact(null);
                fetchContacts();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingContact}
        onOpenChange={(o) => !o && setDeletingContact(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">
              {deletingContact?.first_name} {deletingContact?.last_name}
            </strong>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingContact(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <ClientsPageInner />
    </Suspense>
  );
}
