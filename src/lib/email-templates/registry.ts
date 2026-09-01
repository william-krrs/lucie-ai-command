import type { ComponentType } from "react";
import { template as reminder24h } from "./reminder-24h";
import { template as reminder2h } from "./reminder-2h";
import { template as installationInProgress } from "./installation-in-progress";
import { template as installationReadyForTest } from "./installation-ready-for-test";
import { template as installationLive } from "./installation-live";

export type TemplateEntry = {
  component: ComponentType<any>;
  subject: string | ((data: any) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
};

export const TEMPLATES = {
  "reminder-24h": reminder24h,
  "reminder-2h": reminder2h,
  "installation-in-progress": installationInProgress,
  "installation-ready-for-test": installationReadyForTest,
  "installation-live": installationLive,
} satisfies Record<string, TemplateEntry>;

export type TemplateName = keyof typeof TEMPLATES;
