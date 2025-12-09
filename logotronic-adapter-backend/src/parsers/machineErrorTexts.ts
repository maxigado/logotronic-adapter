// src/parsers/machineErrorTexts.ts
import { ResponseMeta } from "../utility/xml";
import { extractResponseMeta } from "../utility/xml";

/**
 * MachineErrorTexts response interface.
 * This telegram sends data TO server (locations and messages arrays).
 * Response contains only meta fields (typeId, returnCode, errorReason).
 */
export interface MachineErrorTextsResponse extends ResponseMeta {
  // No domain-specific fields - response body is empty per spec
}

/**
 * Parser for MachineErrorTexts response.
 * Extracts only meta fields (typeId, returnCode, errorReason).
 */
export function parseMachineErrorTextsResponse(
  parsed: any,
  meta: ResponseMeta
): MachineErrorTextsResponse {
  // Response contains only meta fields - no domain-specific data
  return {
    typeId: meta.typeId,
    returnCode: meta.returnCode,
    errorReason: meta.errorReason,
  };
}
