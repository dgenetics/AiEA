import { z } from "zod";

const proposedSubtaskSchema = z.object({
  title: z.string().min(1).max(300),
  dueAt: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** Zod schema for a single capture proposal (validated after AI response). */
export const proposedItemSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(2000).nullable().optional(),
  kind: z.enum(["ONE_TIME", "RECURRING_TEMPLATE"]),
  areaSlug: z.enum(["work", "life"]),
  priority: z.number().int().min(1).max(5),
  dueAt: z.string().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  estimateMinutes: z.number().int().min(1).max(480).nullable().optional(),
  recurrenceRule: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
      interval: z.number().int().min(1).max(30),
      byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
      time: z.string().optional(),
      times: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  isFollowUp: z.boolean().optional(),
  personName: z.string().max(120).nullable().optional(),
  followUpDueAt: z.string().nullable().optional(),
  aiRationale: z.string().max(500).optional(),
  subtasks: z.array(proposedSubtaskSchema).max(20).optional(),
});

export const captureProposalsSchema = z.object({
  items: z.array(proposedItemSchema).max(25),
});

export type CaptureProposals = z.infer<typeof captureProposalsSchema>;
export type AiProposedItem = z.infer<typeof proposedItemSchema>;

export const briefPolishSchema = z.object({
  summary: z.string().min(1).max(600),
  tips: z.array(z.string().min(1).max(240)).min(1).max(5),
});

export type BriefPolish = z.infer<typeof briefPolishSchema>;

/**
 * JSON Schema for xAI structured outputs (strict).
 * Keep additionalProperties: false and list every key in required for nested objects.
 */
export const CAPTURE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "notes",
          "kind",
          "areaSlug",
          "priority",
          "dueAt",
          "scheduledFor",
          "estimateMinutes",
          "recurrenceRule",
          "isFollowUp",
          "personName",
          "followUpDueAt",
          "aiRationale",
          "subtasks",
        ],
        properties: {
          title: {
            type: "string",
            description: "Short, actionable parent task title (verb-first).",
          },
          notes: {
            type: ["string", "null"],
            description: "Optional context; null if none.",
          },
          subtasks: {
            type: "array",
            description:
              'Parts under this task. Use when user lists "Subtasks: 1. … 2. …" or numbered parts. Each gets its own due date. Empty array if none.',
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "dueAt", "notes"],
              properties: {
                title: {
                  type: "string",
                  description: "Part title only (not the whole list).",
                },
                dueAt: {
                  type: ["string", "null"],
                  description: "ISO due for this part; inherit parent due if shared.",
                },
                notes: {
                  type: ["string", "null"],
                },
              },
            },
          },
          kind: {
            type: "string",
            enum: ["ONE_TIME", "RECURRING_TEMPLATE"],
          },
          areaSlug: {
            type: "string",
            enum: ["work", "life"],
            description: "Only work or life. Never home.",
          },
          priority: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "1=critical today, 3=normal, 5=someday.",
          },
          dueAt: {
            type: ["string", "null"],
            description: "ISO-8601 date or datetime deadline, or null.",
          },
          scheduledFor: {
            type: ["string", "null"],
            description: "When to work on it (ISO-8601), or null.",
          },
          estimateMinutes: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 480,
          },
          recurrenceRule: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["frequency", "interval", "byWeekday", "time", "times"],
                properties: {
                  frequency: {
                    type: "string",
                    enum: ["daily", "weekly", "monthly", "custom"],
                  },
                  interval: { type: "integer", minimum: 1, maximum: 30 },
                  byWeekday: {
                    type: "array",
                    items: { type: "integer", minimum: 0, maximum: 6 },
                    description: "0=Sunday … 6=Saturday. Empty if N/A.",
                  },
                  time: {
                    type: "string",
                    description: 'Primary HH:mm; first of times if multi-slot.',
                  },
                  times: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      'Multi check-in times on each day, e.g. ["10:00","14:00","18:00"] for 3× daily. Empty array if single time.',
                  },
                },
              },
              { type: "null" },
            ],
          },
          isFollowUp: {
            type: "boolean",
            description: "True if this is a people/response loop.",
          },
          personName: {
            type: ["string", "null"],
            description: "Person to follow up with, or null.",
          },
          followUpDueAt: {
            type: ["string", "null"],
            description: "When the follow-up should happen (ISO-8601), or null.",
          },
          aiRationale: {
            type: "string",
            description: "One short sentence explaining classification choices.",
          },
        },
      },
    },
  },
} as const;

export const BRIEF_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "tips"],
  properties: {
    summary: {
      type: "string",
      description: "2–3 sentence executive briefing for the day.",
    },
    tips: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "string",
        description: "Concrete, actionable coach note (one line).",
      },
    },
  },
} as const;
