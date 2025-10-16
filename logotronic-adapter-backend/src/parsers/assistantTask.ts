import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface AssistantTaskResponse extends ResponseMeta {}

export function parseAssistantTaskResponse(
  _root: ParsedResponseRoot,
  meta: ResponseMeta
): AssistantTaskResponse {
  return { ...meta };
}
