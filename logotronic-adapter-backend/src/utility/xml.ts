import { XMLParser } from "fast-xml-parser";
import logger from "./logger";

// Shared XML parser instance configuration tailored for Logotronic Rapida responses.
// We enable attribute parsing, preserve order where needed, and ignore namespace complexity (not used).
const parser = new XMLParser({
  ignoreDeclaration: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: true, // convert numbers & booleans automatically when safe
  trimValues: true,
});

export interface ParsedResponseRoot {
  Response?: any; // dynamic shape; attributes will be on Response["@_attrName"]
  Request?: any;
}

/**
 * Parse an XML string safely, returning the root object or null on failure.
 * Logs errors but never throws to keep handler stability.
 */
export function safeParseXml(xml: string): ParsedResponseRoot | null {
  try {
    if (!xml || xml.trim() === "") return null;
    const obj = parser.parse(xml) as ParsedResponseRoot;
    return obj;
  } catch (err) {
    logger.error(`XML parse error: ${err}`);
    return null;
  }
}

/**
 * Extract core Response attributes (typeId, returnCode, errorReason?) from a parsed XML root.
 * Returns undefined if mandatory attributes are missing.
 */
export interface ResponseMeta {
  typeId: number;
  returnCode: number;
  errorReason?: string;
}

export function extractResponseMeta(
  root: ParsedResponseRoot
): ResponseMeta | undefined {
  if (!root || !root.Response) return undefined;
  const resp = root.Response;
  const typeId = resp["@_typeId"] ?? resp["@_typeld"]; // typographical variance
  const returnCode = resp["@_returnCode"];
  const errorReason = resp["@_errorReason"];
  if (typeId === undefined || returnCode === undefined) return undefined;
  const rcNum = Number(returnCode);
  return {
    typeId: Number(typeId),
    returnCode: rcNum,
    errorReason:
      rcNum !== 1
        ? errorReason !== undefined
          ? String(errorReason)
          : undefined
        : undefined,
  };
}
