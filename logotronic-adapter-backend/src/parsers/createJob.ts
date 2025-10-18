import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface CreateJobResponse extends ResponseMeta {}

export function parseCreateJobResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): CreateJobResponse {
  return { ...meta };
}
