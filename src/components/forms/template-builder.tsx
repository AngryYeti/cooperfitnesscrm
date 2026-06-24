/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Eye,
  Code,
  Save,
  Loader2,
  MoveUp,
  MoveDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createFormTemplate } from "@/lib/actions/forms";
import { cn } from "@/lib/utils";

interface FormField {
  id: string;
  type: "text" | "signature" | "date" | "checkbox" | "paragraph";
  label: string;
  required: boolean;
}

export function TemplateBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");
  const [fields, setFields] = useState<FormField[]>([
    { id: "1", type: "paragraph", label: "Please read this waiver carefully and sign below to confirm agreement.", required: false }
  ]);
  const [htmlContent, setHtmlContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Field Editor Form State
  const [newType, setNewType] = useState<FormField["type"]>("paragraph");
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(true);

  // Add field to visual builder
  const handleAddField = () => {
    if (!newLabel.trim()) return;
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: newType,
      label: newLabel.trim(),
      required: newRequired,
    };
    setFields([...fields, newField]);
    setNewLabel("");
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  // Reorder fields
  const moveField = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setFields(updated);
  };

  // Compile visual builder fields to DocuSeal HTML
  const compileToHTML = (templatesFields: FormField[]) => {
    let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; line-height: 1.5; color: #171717; }
    h1 { font-size: 24px; font-weight: bold; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 20px; }
    p { margin-bottom: 16px; font-size: 14px; }
    .field-row { margin-bottom: 18px; font-size: 14px; }
    .field-label { font-weight: 600; display: block; margin-bottom: 6px; }
    .signature-container { margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 15px; }
  </style>
</head>
<body>
  <h1>${name || "Fitness Program Agreement"}</h1>
`;

    templatesFields.forEach((field) => {
      if (field.type === "paragraph") {
        html += `  <p>${field.label}</p>\n`;
      } else if (field.type === "text") {
        html += `  <div class="field-row">\n    <span class="field-label">${field.label}${field.required ? " *" : ""}</span>\n    <text-field name="${field.label}" role="Signer" required="${field.required}"></text-field>\n  </div>\n`;
      } else if (field.type === "date") {
        html += `  <div class="field-row">\n    <span class="field-label">${field.label}${field.required ? " *" : ""}</span>\n    <date-field name="${field.label}" role="Signer" required="${field.required}"></date-field>\n  </div>\n`;
      } else if (field.type === "checkbox") {
        html += `  <div class="field-row">\n    <p>\n      <check-box name="${field.label}" role="Signer" required="${field.required}"></check-box> &nbsp; ${field.label}${field.required ? " *" : ""}\n    </p>\n  </div>\n`;
      } else if (field.type === "signature") {
        html += `  <div class="field-row signature-container">\n    <span class="field-label">${field.label}</span>\n    <signature-field role="Signer" required="true"></signature-field>\n  </div>\n`;
      }
    });

    html += `</body>
</html>`;
    return html;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSaving(true);
    try {
      const finalHTML = activeTab === "visual" ? compileToHTML(fields) : htmlContent;
      await createFormTemplate(name.trim(), finalHTML, fields);
      router.push("/forms");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Sync visual code to html code when switching tabs
  const handleTabChange = (tab: "visual" | "code") => {
    if (tab === "code" && activeTab === "visual") {
      setHtmlContent(compileToHTML(fields));
    }
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/forms">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Custom Form</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Design templates and request signatures using DocuSeal
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !name.trim()} className="shadow-soft">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>

      {/* Template Name Input */}
      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-5">
          <div className="space-y-1.5">
            <Label htmlFor="template-name" className="text-sm font-semibold">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Liability Waiver, PT Contract, PAR-Q Form"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md h-10 border-border/80"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs list */}
      <div className="flex items-center bg-muted/40 rounded-md p-1 self-start w-fit">
        <button
          onClick={() => handleTabChange("visual")}
          className={cn(
            "flex items-center gap-1.5 px-4 h-8 text-xs font-semibold rounded-[5px] transition-all",
            activeTab === "visual"
              ? "bg-background text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Visual Builder
        </button>
        <button
          onClick={() => handleTabChange("code")}
          className={cn(
            "flex items-center gap-1.5 px-4 h-8 text-xs font-semibold rounded-[5px] transition-all",
            activeTab === "code"
              ? "bg-background text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Code className="h-3.5 w-3.5" />
          Raw HTML Editor
        </button>
      </div>

      {activeTab === "visual" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls - Left column */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="border-border/60 shadow-soft">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Add Form Element
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Element Type</Label>
                    <select
                      value={newType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setNewType(val);
                        if (val === "signature") setNewLabel("Signer Signature");
                      }}
                      className="w-full h-10 px-3 bg-card border border-border/80 rounded-md focus:outline-none cursor-pointer text-sm"
                    >
                      <option value="paragraph">Text Block / Instruction</option>
                      <option value="text">Text Input Field</option>
                      <option value="date">Date Picker Field</option>
                      <option value="checkbox">Agreement Checkbox</option>
                      <option value="signature">Signature Field</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {newType === "paragraph" ? "Text Content" : "Field Label"}
                    </Label>
                    {newType === "paragraph" ? (
                      <Textarea
                        placeholder="Type paragraph text here..."
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    ) : (
                      <Input
                        placeholder={newType === "signature" ? "Signer Signature" : "e.g. Full Name, Date of Birth"}
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="h-10"
                      />
                    )}
                  </div>

                  {newType !== "paragraph" && newType !== "signature" && (
                    <label className="flex items-center gap-2 cursor-pointer py-1.5">
                      <input
                        type="checkbox"
                        checked={newRequired}
                        onChange={(e) => setNewRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-xs font-medium">Required field</span>
                    </label>
                  )}

                  <Button
                    onClick={handleAddField}
                    disabled={!newLabel.trim()}
                    className="w-full h-10 mt-2 shadow-soft"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Element
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview & Ordering - Right column */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pl-1">
              Document Preview & Fields
            </h3>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <Card key={field.id} className="border-border/60 hover:border-foreground/15 transition-all shadow-soft overflow-hidden">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-1 flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-xs font-bold text-primary shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1">
                          {field.type}
                        </span>
                        <p className={cn(
                          "text-sm font-medium leading-relaxed break-words",
                          field.type === "paragraph" ? "text-muted-foreground italic font-normal" : "text-foreground"
                        )}>
                          {field.label}
                        </p>
                        {field.type !== "paragraph" && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", field.required ? "bg-red-500" : "bg-gray-400")} />
                            {field.required ? "Mandatory field" : "Optional field"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={idx === 0}
                        onClick={() => moveField(idx, "up")}
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={idx === fields.length - 1}
                        onClick={() => moveField(idx, "down")}
                      >
                        <MoveDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveField(field.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {fields.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center shadow-soft">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Your form is empty.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add text blocks and input fields on the left to start building.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Raw HTML Editor */
        <Card className="border-border/60 shadow-soft">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Raw HTML Code</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Provide custom HTML structure with DocuSeal tags (e.g. <code>{"<text-field name=\"Name\" role=\"Signer\" required=\"true\"></text-field>"}</code> or <code>{"<signature-field role=\"Signer\"></signature-field>"}</code>).
              </p>
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={18}
                className="font-mono text-xs leading-relaxed border-border/80"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
