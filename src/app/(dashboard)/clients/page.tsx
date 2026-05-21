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
import { Label } from "@/components/ui/label";
import { ContactForm } from "@/components/forms/contact-form";

const statusOptions: ContactStatus[] = [
  "Lead",
  "Trial",
  "Active Client",
  "Completed",
];

const statusBadgeMap: Record<ContactStatus, string> = {
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients & Leads</h1>
          <p className="text-muted-foreground">Manage your contacts and clients</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
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
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ContactStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
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
        <div className="text-center py-12 text-muted-foreground">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "No contacts found matching your search" : "No contacts yet. Add your first contact!"}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Goal</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Source</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${contact.id}`}
                        className="font-medium hover:underline"
                      >
                        {contact.first_name} {contact.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {contact.phone || contact.email || "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {contact.fitness_goal || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeMap[contact.status] as any}>
                        {contact.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {contact.source || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                            Toggle Lead/Active
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
            <strong>
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
