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
import {
  parseSetOrderNoteResponse,
  SetOrderNoteResponse,
} from "./setOrderNote";
import {
  parseBdePersonnelResponse,
  BdePersonnelResponse,
} from "./bdePersonnel";
import { parseDeleteJobResponse, DeleteJobResponse } from "./deleteJob";
import {
  parseMachinePlanListResponse,
  MachinePlanListResponse,
} from "./machinePlanList";
import {
  parseOrderHeadDataExchangeResponse,
  OrderHeadDataExchangeResponse,
} from "./orderHeadDataExchange";
import {
  parseProdHeadDataExchangeResponse,
  ProdHeadDataExchangeResponse,
} from "./prodHeadDataExchange";
import {
  parseJobHeadDataExchangeResponse,
  JobHeadDataExchangeResponse,
} from "./jobHeadDataExchange";
import {
  parseOperationalDataResponse,
  OperationalDataResponse,
} from "./operationalData";
import {
  parseAssistantTaskQueryResponse,
  AssistantTaskQueryResponse,
} from "./assistantTaskQuery";

export type DomainResponse =
  | AssistantTaskResponse
  | PersonnelResponse
  | DisconnectResponse
  | UserEventResponse
  | CreateChangePersonnelResponse
  | SaveRepetitionDataResponse
  | CreateJobResponse
  | SetOrderNoteResponse
  | BdePersonnelResponse
  | DeleteJobResponse
  | MachinePlanListResponse
  | OrderHeadDataExchangeResponse
  | ProdHeadDataExchangeResponse
  | JobHeadDataExchangeResponse
  | OperationalDataResponse
  | AssistantTaskQueryResponse
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
  10007: parseSetOrderNoteResponse,
  10008: parseBdePersonnelResponse,
  10165: parseDeleteJobResponse,
  10068: parseMachinePlanListResponse,
  11010: parseOrderHeadDataExchangeResponse,
  11020: parseProdHeadDataExchangeResponse,
  11030: parseJobHeadDataExchangeResponse,
  10011: parseOperationalDataResponse,
  10030: parseAssistantTaskQueryResponse,
};

export function parseDomainResponse(
  root: ParsedResponseRoot
): DomainResponse | undefined {
  const meta = extractResponseMeta(root);
  if (!meta) return undefined;
  const parser = registry[meta.typeId];
  return parser ? parser(root, meta) : meta;
}
