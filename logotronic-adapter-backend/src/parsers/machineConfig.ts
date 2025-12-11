import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface MachineConfigResponse extends ResponseMeta {}

export function parseMachineConfigResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): MachineConfigResponse {
  return { ...meta };
}
