"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type FormField, type FormTemplate } from "./form-templates";

export function FormRenderer({
  template,
  initialData,
  onSubmit,
  submitting,
}: {
  template: FormTemplate;
  initialData?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => void;
  submitting?: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, string>>(
    initialData || {}
  );
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };

  const validate = (): boolean => {
    const missing = new Set<string>();
    for (const field of template.fields) {
      if (field.required) {
        const val = formData[field.name];
        if (!val || val.trim() === "") missing.add(field.name);
      }
    }
    setErrors(missing);
    return missing.size === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || "";
    const hasError = errors.has(field.name);

    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={hasError ? "border-destructive" : ""}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => updateField(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className={hasError ? "border-destructive" : ""}
          />
        );

      case "select":
        return (
          <Select value={value} onValueChange={(v) => updateField(field.name, v)}>
            <SelectTrigger className={hasError ? "border-destructive" : ""}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <div className="flex gap-4">
            {field.options?.map((o) => (
              <label
                key={o.value}
                className={`flex items-center gap-2 cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors ${
                  value === o.value
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => updateField(field.name, o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(e) =>
                updateField(field.name, e.target.checked ? "true" : "")
              }
              className="h-4 w-4 rounded border-gray-300 mt-0.5"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {template.fields.map((field) => (
        <div key={field.name} className="space-y-2">
          {field.type !== "checkbox" && (
            <Label>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
          )}
          {renderField(field)}
          {errors.has(field.name) && (
            <p className="text-xs text-destructive">This field is required</p>
          )}
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving..." : "Save & Continue"}
      </Button>
    </form>
  );
}
