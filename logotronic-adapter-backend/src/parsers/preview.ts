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

/**
 * Strips CDATA wrapper from a string if present.
 * Handles formats: [CDATA[...]], <![CDATA[...]]>, or just the content.
 */
function stripCData(data: string | undefined): string {
  if (!data) return "";
  let result = data.trim();

  // Remove <![CDATA[ prefix
  if (result.startsWith("<![CDATA[")) {
    result = result.substring(9);
  }
  // Remove [CDATA[ prefix (without <!)
  else if (result.startsWith("[CDATA[")) {
    result = result.substring(7);
  }

  // Remove ]]> suffix
  if (result.endsWith("]]>")) {
    result = result.substring(0, result.length - 3);
  }
  // Remove ]] suffix (without >)
  else if (result.endsWith("]]")) {
    result = result.substring(0, result.length - 2);
  }

  return result.trim();
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
      dataBase64 = stripCData(String(node["#text"]));
    } else if (typeof node === "string") {
      // In some rare malformed cases the node itself may be a string
      dataBase64 = stripCData(node);
    }
    jpegData.push({ side, dataBase64 });
  }
  return { ...meta, jpegData };
}
