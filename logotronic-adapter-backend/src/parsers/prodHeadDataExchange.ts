import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

// prodHeadDataExchange response contains only meta attributes (typeId, returnCode, optional errorReason)
export interface ProdHeadDataExchangeResponse extends ResponseMeta {}

export function parseProdHeadDataExchangeResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): ProdHeadDataExchangeResponse {
  return { ...meta };
}
