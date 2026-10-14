import OpenAI from "openai";
import { responseText } from "@/lib/ai/client";

/** Fast nameplate reader. Image in, no web search, reasoning off. */
export const DEFAULT_LABEL_MODEL = "grok-4.3";
/** Manual and schedule search. Override with COMPONENT_SCAN_MODEL. */
export const DEFAULT_COMPONENT_SCAN_MODEL = "grok-4.7";

export type ComponentScanConfig = {
  configured: boolean;
  /** Nameplate read. */
  labelModel: string;
  /** Manual and schedule search. */
  model: string;
  baseURL: string;
  key: string;
};

export function getComponentScanConfig(): ComponentScanConfig {
  const key = process.env.COMPONENT_SCAN_API_KEY?.trim() || "";
  const model = process.env.COMPONENT_SCAN_MODEL?.trim() || DEFAULT_COMPONENT_SCAN_MODEL;
  const labelModel = process.env.COMPONENT_SCAN_LABEL_MODEL?.trim() || DEFAULT_LABEL_MODEL;
  const baseURL = process.env.COMPONENT_SCAN_BASE_URL?.trim() || "https://api.x.ai/v1";
  return {
    configured: key.length > 0,
    labelModel,
    model,
    baseURL,
    key,
  };
}

const LABEL_INSTRUCTIONS = `You read a nameplate photo. Do not search the web. Do not invent part numbers, serial numbers, or URLs.

Return only JSON with this shape:
{
  "name": "",
  "manufacturer": "",
  "modelNumber": "",
  "productNumber": "",
  "serialNumber": "",
  "warrantyInfo": "",
  "vendorName": ""
}

Rules:
- Copy only text that is visible on the label.
- manufacturer and modelNumber are separate. Never combine them into one field.
- productNumber is the part number, P/N, or SKU printed on the label.
- serialNumber is the S/N only.
- name names the equipment. A Grundfos SQ submersible is a well pump. When make and model are printed, include them, as in "Well Pump" or "Grundfos SQ 3-65 Pump". Do not answer with only "Pump" when a make or model is visible. Leave name empty only when the label does not show what the equipment is.
- warrantyInfo and vendorName only when they are printed on the label. Otherwise empty strings.
- Prefer the label over the barcode when they disagree. Use the barcode to fill a part number or serial the photo does not show.`;

const LOOKUP_INSTRUCTIONS = `Find the official owner's manual for this equipment. Use web search. Do not invent URLs.

Return only JSON with this shape:
{
  "name": "",
  "manufacturer": "",
  "modelNumber": "",
  "productNumber": "",
  "serialNumber": "",
  "warrantyInfo": "",
  "vendorName": "",
  "manual": { "url": "", "title": "", "kind": "PDF" },
  "schedule": { "name": "", "everyCount": 1, "everyUnit": "year", "note": "per the manual" }
}

Rules:
- manual.url is an http or https link to the manufacturer's own manual PDF or page. Leave it empty if search does not find one.
- manual.kind is PDF when the link is a PDF, otherwise page.
- schedule is one recurring task the manual itself states, with a number and a unit. everyUnit is day, week, month, or year. If the manual says annually, yearly, or once a year, use everyCount 1 and everyUnit year. If it says every 6 months, use everyCount 6 and everyUnit month. If the manual says the equipment is maintenance-free, or states no interval, leave schedule.name as an empty string. Do not invent an interval.
- Leave name, manufacturer, modelNumber, productNumber, and serialNumber empty.`;

function clientFor(config: ComponentScanConfig, timeout: number): OpenAI {
  return new OpenAI({
    apiKey: config.key,
    baseURL: config.baseURL,
    timeout,
    maxRetries: 0,
  });
}

/** Fast nameplate read: low detail, no web search. */
export async function readComponentLabel(
  args: { imageDataUrl: string; decodedCode: string | null },
  config = getComponentScanConfig(),
): Promise<string> {
  if (!config.configured) throw new Error("COMPONENT_SCAN_API_KEY is not set");

  const codeLine = args.decodedCode
    ? `Decoded barcode or QR value: ${args.decodedCode.slice(0, 500)}`
    : "No barcode or QR value was decoded.";

  const client = clientFor(config, 20_000);
  const resp = await client.responses.create({
    model: config.labelModel,
    store: false,
    reasoning: { effort: "none" },
    max_output_tokens: 500,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${LABEL_INSTRUCTIONS}\n\n${codeLine}` },
          { type: "input_image", image_url: args.imageDataUrl, detail: "low" },
        ],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  const text = responseText(resp);
  if (!text.trim()) throw new Error("Empty response from label scan");
  return text;
}

/** Optional follow-up. Web search for the manual only, after the label fields are already shown. */
export async function lookupComponentManual(
  args: { manufacturer: string; modelNumber: string; productNumber: string; name: string },
  config = getComponentScanConfig(),
): Promise<string> {
  if (!config.configured) throw new Error("COMPONENT_SCAN_API_KEY is not set");

  const lines = [
    args.manufacturer ? `Manufacturer: ${args.manufacturer}` : "",
    args.modelNumber ? `Model: ${args.modelNumber}` : "",
    args.productNumber ? `Part number: ${args.productNumber}` : "",
    args.name ? `Name: ${args.name}` : "",
  ].filter(Boolean);

  const client = clientFor(config, 90_000);
  const resp = await client.responses.create({
    model: config.model,
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 800,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: `${LOOKUP_INSTRUCTIONS}\n\n${lines.join("\n")}` }],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  const text = responseText(resp);
  if (!text.trim()) throw new Error("Empty response from manual lookup");
  return text;
}
