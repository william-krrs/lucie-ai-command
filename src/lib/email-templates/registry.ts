import type { ComponentType } from "react";
import { template as reminder24h } from "./reminder-24h";
import { template as reminder2h } from "./reminder-2h";

export type TemplateEntry = {
  component: ComponentType<any>;
  subject: string | ((data: any) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
};

export const TEMPLATES = {
  "reminder-24h": reminder24h,
  "reminder-2h": reminder2h,
} satisfies Record<string, TemplateEntry>;

export type TemplateName = keyof typeof TEMPLATES;