"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Tag,
  Target,
  Trash2,
  
              Assign Template
            </Button>
          </div>
          {checklists.map((checklist) => {
            const completed = checklist.items.filter((i: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => i.completed).length;
            const total = checklist.items.length;
            const pct = total > 0 ? (completed / total) * 100 : 0;
            return (
              <Card key={checklist.id} className="border-border/60 shadow-soft">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Checklist</p>
                    <span className="text-xs text-muted-foreground">
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {checklist.items.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                      <label
                        key={index}
                        className="flex items-center gap-3 cursor-pointer rounded-md px-1 py-1 hover:bg-muted/30 transition-colors"
                      >
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                            item.completed
                              ? "bg-foreground border-foreground"
                              : "border-input"
                          }`}
                          onClick={() =>
                            handleToggleChecklist(
                              checklist.id,
                              index,
                              !item.completed
                            )
                          }
                        >
                          {item.completed && (
                            <Check className="h-3 w-3 text-background" strokeWidth={3} />
                          )}
                        </div>
                        <span
                          className={`text-sm flex-1 ${
                            item.completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.completed_at), "MMM d")}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {checklists.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No checklists assigned. Assign a template to get started.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="followups" className="space-y-2 mt-4">
          {followUps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No follow-ups scheduled.
              </p>
            </div>
          ) : (
            followUps.map((fu: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
              <Card
                key={fu.id}
                className={`border-border/60 shadow-soft ${
                  fu.completed ? "opacity-50" : ""
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        fu.completed ? "bg-muted" : "bg-primary/10"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{fu.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(fu.due_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {fu.completed ? (
                    <Badge variant="success" className="text-[10px]">
                      Completed
                    </Badge>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20"
                      onClick={() => handleCompleteFollowUp(fu.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                placeholder="e.g. Check in on nutrition plan"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddFollowUp}
              disabled={!followUpTitle.trim() || !followUpDate}
            >
              Add Follow-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAssignTemplate(template.id)}
              >
                <ListChecks className="mr-2 h-4 w-4" />
                {template.name}
              </Button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No templates available. Create one in Settings.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableNameField({
  contact,
  saving,
  onSave,
}: {
  contact: Contact;
  saving: boolean;
  onSave: (firstName: string, lastName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(contact.first_name);
  const [last, setLast] = useState(contact.last_name || "");
  const [prevFirst, setPrevFirst] = useState(contact.first_name);
  const [prevLast, setPrevLast] = useState(contact.last_name || "");
  const firstRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  if (!editing && (contact.first_name !== prevFirst || (contact.last_name || "") !== prevLast)) {
    setPrevFirst(contact.first_name);
    setPrevLast(contact.last_name || "");
    setFirst(contact.first_name);
    setLast(contact.last_name || "");
  }

  useEffect(() => {
    if (editing) firstRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmedFirst = first.trim();
    const trimmedLast = last.trim();
    if (
      !trimmedFirst ||
      (trimmedFirst === contact.first_name &&
        trimmedLast === (contact.last_name || ""))
    ) {
      setEditing(false);
      setFirst(contact.first_name);
      setLast(contact.last_name || "");
      return;
    }
    onSave(trimmedFirst, trimmedLast);
    setEditing(false);
  };

  const cancel = () => {
    setFirst(contact.first_name);
    setLast(contact.last_name || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={groupRef}
        className="flex items-center gap-1.5 flex-wrap"
        onBlur={(e) => {
          if (!groupRef.current?.contains(e.relatedTarget as Node)) {
            commit();
          }
        }}
      >
        <Input
          ref={firstRef}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={saving}
          className="h-9 text-lg font-bold w-40"
          placeholder="First"
        />
        <Input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={saving}
          className="h-9 text-lg font-bold w-40"
          placeholder="Last"
        />
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-2 rounded-md px-1 -ml-1 hover:bg-muted/60 transition-colors text-left"
      title="Click to edit name"
    >
      <h1 className="text-2xl font-bold tracking-tight">
        {getFullName(contact.first_name, contact.last_name)}
      </h1>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function EditableInfoRow({
  icon,
  label,
  value,
  placeholder,
  type = "text",
  multiline = false,
  saving,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "email" | "tel";
  multiline?: boolean;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  if (!editing && value !== prevValue) {
    setPrevValue(value);
    setTemp(value);
  }

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    }
  }, [editing]);

  const commit = () => {
    if (temp === value) {
      setEditing(false);
      return;
    }
    onSave(temp.trim());
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {editing ? (
          multiline ? (
            <Textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={() => setTimeout(commit, 100)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setTemp(value);
                  setEditing(false);
                }
              }}
              disabled={saving}
              rows={2}
              className="mt-1 text-sm resize-none"
            />
          ) : (
            <Input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type={type}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={() => setTimeout(commit, 100)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setTemp(value);
                  setEditing(false);
                }
              }}
              disabled={saving}
              className="h-8 mt-0.5 text-sm"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "group flex items-center gap-1.5 rounded px-1 -ml-1 py-0.5 hover:bg-muted/60 transition-colors w-full text-left",
              saving && "opacity-60 pointer-events-none"
            )}
            title="Click to edit"
          >
            <p
              className={cn(
                "text-sm font-medium truncate flex-1",
                !value && "text-muted-foreground/60 italic font-normal"
              )}
            >
              {value || placeholder}
            </p>
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
