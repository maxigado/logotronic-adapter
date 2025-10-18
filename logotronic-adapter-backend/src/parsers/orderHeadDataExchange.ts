import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// orderHeadDataExchange response contains only meta attributes
export interface OrderHeadDataExchangeResponse extends ResponseMeta {}

export function parseOrderHeadDataExchangeResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): OrderHeadDataExchangeResponse {
  return { ...meta };
}
