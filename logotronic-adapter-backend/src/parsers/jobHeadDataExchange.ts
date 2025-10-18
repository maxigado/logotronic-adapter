import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface JobHeadDataExchangeResponse extends ResponseMeta {}

export function parseJobHeadDataExchangeResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): JobHeadDataExchangeResponse {
  // Meta-only parser: simply return the meta information for jobHeadDataExchange
  return { ...meta };
}
