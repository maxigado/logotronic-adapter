import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// Disconnect response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface DisconnectResponse extends ResponseMeta {}

export function parseDisconnectResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): DisconnectResponse {
  return { ...meta };
}
