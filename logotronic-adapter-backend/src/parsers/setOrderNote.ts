import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// setOrderNote response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface SetOrderNoteResponse extends ResponseMeta {}

export function parseSetOrderNoteResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): SetOrderNoteResponse {
  return { ...meta };
}
