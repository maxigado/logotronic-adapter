import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface CreateChangePersonnelResponse extends ResponseMeta {}

export function parseCreateChangePersonnelResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): CreateChangePersonnelResponse {
  return { ...meta };
}
