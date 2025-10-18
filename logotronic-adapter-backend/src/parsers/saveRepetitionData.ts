import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface SaveRepetitionDataResponse extends ResponseMeta {}

export function parseSaveRepetitionDataResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): SaveRepetitionDataResponse {
  return { ...meta };
}
