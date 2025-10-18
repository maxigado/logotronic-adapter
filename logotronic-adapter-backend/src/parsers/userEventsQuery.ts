import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface UserEventEntry {
  no?: number | string;
  name?: string;
  type?: number;
  machineTime?: number;
  machineTimeName?: string;
  sendPolicy?: number;
  sendPolicy2?: number;
  blockingPolicy?: number;
  interruptRun?: number;
  speedReduction?: number;
}

export interface EventGroupEntry {
  name?: string;
  userEvents: UserEventEntry[];
}

export interface UserEventsQueryResponse extends ResponseMeta {
  groups: EventGroupEntry[];
}

function normalizeArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseUserEventsQueryResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): UserEventsQueryResponse {
  const resp = root.Response || {};
  const rawGroups = normalizeArray<any>(resp.EventGroup);
  const groups: EventGroupEntry[] = rawGroups.map((g: any) => {
    const rawEvents = normalizeArray<any>(g.UserEvent);
    const userEvents: UserEventEntry[] = rawEvents.map((e: any) => ({
      no: e["@_no"],
      name: e["@_name"],
      type: e["@_type"],
      machineTime: e["@_machineTime"],
      machineTimeName: e["@_machineTimeName"],
      sendPolicy: e["@_sendPolicy"],
      sendPolicy2: e["@_sendPolicy2"],
      blockingPolicy: e["@_blockingPolicy"],
      interruptRun: e["@_interruptRun"],
      speedReduction: e["@_speedReduction"],
    }));
    return {
      name: g["@_name"],
      userEvents,
    };
  });
  return { ...meta, groups };
}
