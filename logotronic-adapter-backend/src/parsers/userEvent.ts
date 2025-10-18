import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// userEvent response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface UserEventResponse extends ResponseMeta {}

export function parseUserEventResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): UserEventResponse {
  return { ...meta };
}
