import OpenAI from "openai";
import { responseText } from "@/lib/ai/client";

/** Vision plus live web search. Override with COMPONENT_SCAN_MODEL. */
export const DEFAULT_COMPONENT_SCAN_MODEL = "grok-4.7";

export type ComponentScanConfig = {
  configured: boolean;
  model: string;
  baseURL: string;
  key: string;
};

export function getComponentScanConfig(): ComponentScanConfig {
  const key = process.env.COMPONENT_SCAN_API_KEY?.trim() || "";
  const model = process.env.COMPONENT_SCAN_MODEL?.trim() || DEFAULT_COMPONENT_SCAN_MODEL;
  const baseURL = process.env.COMPONENT_SCAN_BASE_URL?.trim() || "https://api.x.ai/v1";
  return {
    configured: key.length > 0,
    model,
    baseURL,
    key,
  };
}

const INSTRUCTIONS = `You identify a piece of farm or home equipment from a nameplate photo and, when given, a decoded barcode or QR value.

Use the image for make, model, serial, and part number. Use web search to find the official manual and one typical maintenance task from it. Do not invent URLs, part numbers, serial numbers, or intervals.

Return only JSON with this shape:
{
  "name": "short everyday name such as Well Pump",
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
- manufacturer and modelNumber are separate. Never combine them into one field.
- productNumber is the part number, P/N, or SKU printed on the label.
- serialNumber is the S/N only.
- name is a short suggested equipment name, not the model string.
- manual.url is an http or https link to the manufacturer's own manual PDF or page. Leave it empty if search does not find one.
- manual.kind is PDF when the link is a PDF, otherwise page.
- schedule is one typical recurring maintenance task for this model. everyUnit is day, week, month, or year. Leave schedule.name empty if you cannot find one.
- warrantyInfo and vendorName only when the label or the manual states them. Otherwise empty strings.
- Prefer the label over the barcode when they disagree. Use the barcode to fill a part number or serial the photo does not show.`;

/** One Responses API call: the nameplate image plus web search. */
export async function readComponentLabel(
  args: { imageDataUrl: string; decodedCode: string | null },
  config = getComponentScanConfig(),
): Promise<string> {
  if (!config.configured) throw new Error("COMPONENT_SCAN_API_KEY is not set");

  const codeLine = args.decodedCode
    ? `Decoded barcode or QR value: ${args.decodedCode.slice(0, 500)}`
    : "No barcode or QR value was decoded.";

  const client = new OpenAI({
    apiKey: config.key,
    baseURL: config.baseURL,
    timeout: 90_000,
    maxRetries: 0,
  });

  const resp = await client.responses.create({
    model: config.model,
    store: false,
    max_output_tokens: 2000,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${INSTRUCTIONS}\n\n${codeLine}` },
          { type: "input_image", image_url: args.imageDataUrl, detail: "high" },
        ],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  const text = responseText(resp);
  if (!text.trim()) throw new Error("Empty response from label scan");
  return text;
}
