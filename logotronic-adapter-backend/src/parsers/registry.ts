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
import { parseUserEventResponse, UserEventResponse } from "./userEvent";
import {
  parseCreateChangePersonnelResponse,
  CreateChangePersonnelResponse,
} from "./createChangePersonnel";
import {
  parseSaveRepetitionDataResponse,
  SaveRepetitionDataResponse,
} from "./saveRepetitionData";
import { parseCreateJobResponse, CreateJobResponse } from "./createJob";

export type DomainResponse =
  | AssistantTaskResponse
  | PersonnelResponse
  | DisconnectResponse
  | UserEventResponse
  | CreateChangePersonnelResponse
  | SaveRepetitionDataResponse
  | CreateJobResponse
  | ResponseMeta;

type ParserFn = (
  root: ParsedResponseRoot,
  meta: ResponseMeta
) => DomainResponse;

const registry: Record<number, ParserFn> = {
  10015: parseAssistantTaskResponse,
  10036: parsePersonnelResponse,
  10010: parseDisconnectResponse,
  10012: parseUserEventResponse,
  10038: parseCreateChangePersonnelResponse,
  10050: parseSaveRepetitionDataResponse,
  10063: parseCreateJobResponse,
};

export function parseDomainResponse(
  root: ParsedResponseRoot
): DomainResponse | undefined {
  const meta = extractResponseMeta(root);
  if (!meta) return undefined;
  const parser = registry[meta.typeId];
  return parser ? parser(root, meta) : meta;
}
