import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface PreviewJpegEntry {
  side?: string | number;
  dataBase64?: string; // raw base64 JPEG data (text/CDATA content)
}

export interface PreviewResponse extends ResponseMeta {
  jpegData: PreviewJpegEntry[];
}

function normalizeArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export function parsePreviewResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): PreviewResponse {
  const resp = root.Response || {};
  // Primary location: nested under <Response>
  let jpegNodes = normalizeArray<any>(resp.JPEGData);
  // Fallback: if not present under Response, attempt to read from root (some servers may send siblings)
  if (jpegNodes.length === 0) {
    const rootLevel = (root as any).JPEGData;
    jpegNodes = normalizeArray<any>(rootLevel);
  }
  const jpegData: PreviewJpegEntry[] = [];
  for (const node of jpegNodes) {
    const side = node?.["@_side"];
    // fast-xml-parser puts text content in '#text'
    let dataBase64: string | undefined;
    if (node?.["#text"]) {
      dataBase64 = String(node["#text"]);
    } else if (typeof node === "string") {
      // In some rare malformed cases the node itself may be a string
      dataBase64 = node;
    }
    jpegData.push({ side, dataBase64 });
  }
  return { ...meta, jpegData };
}
