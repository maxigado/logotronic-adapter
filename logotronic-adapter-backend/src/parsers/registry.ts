import {
  ParsedResponseRoot,
  extractResponseMeta,
  ResponseMeta,
} from "../utility/xml";
import {
  parseAssistantTaskResponse,
  AssistantTaskResponse,
} from "./assistantTask";
import { parsePersonnelResponse, PersonnelResponse } from "./personnel";
import { parseDisconnectResponse, DisconnectResponse } from "./disconnect";

export type DomainResponse =
  | AssistantTaskResponse
  | PersonnelResponse
  | DisconnectResponse
  | ResponseMeta;

type ParserFn = (
  root: ParsedResponseRoot,
  meta: ResponseMeta
) => DomainResponse;

const registry: Record<number, ParserFn> = {
  10015: parseAssistantTaskResponse,
  10036: parsePersonnelResponse,
  10010: parseDisconnectResponse,
};

export function parseDomainResponse(
  root: ParsedResponseRoot
): DomainResponse | undefined {
  const meta = extractResponseMeta(root);
  if (!meta) return undefined;
  const parser = registry[meta.typeId];
  return parser ? parser(root, meta) : meta;
}
