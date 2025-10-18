import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// machinePlanList response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface MachinePlanListResponse extends ResponseMeta {}

export function parseMachinePlanListResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): MachinePlanListResponse {
  return { ...meta };
}
