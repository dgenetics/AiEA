/** Model, part number, and serial, in that order, omitting blanks. */
export function componentIdentityRows(part: {
  manufacturer?: string;
  modelNumber?: string;
  productNumber?: string;
  serialNumber?: string;
}): { label: string; value: string }[] {
  const model = [part.manufacturer ?? "", part.modelNumber ?? ""]
    .map((piece) => piece.trim())
    .filter(Boolean)
    .join(" ");
  return [
    { label: "Model", value: model },
    { label: "Part number", value: (part.productNumber ?? "").trim() },
    { label: "Serial", value: (part.serialNumber ?? "").trim() },
  ].filter((row) => row.value);
}
