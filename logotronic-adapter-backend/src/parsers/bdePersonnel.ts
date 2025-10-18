import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// bdePersonnel response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface BdePersonnelResponse extends ResponseMeta {}

export function parseBdePersonnelResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): BdePersonnelResponse {
  return { ...meta };
}
