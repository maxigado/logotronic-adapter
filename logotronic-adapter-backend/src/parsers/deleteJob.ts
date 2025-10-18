import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// deleteJob response contains only meta attributes
export interface DeleteJobResponse extends ResponseMeta {}

export function parseDeleteJobResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): DeleteJobResponse {
  return { ...meta };
}
