import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface AssistantTaskQueryItem {
  no: number;
  text: string;
  priority: number;
}

export interface AssistantTaskQueryGroup {
  no: number;
  name: string;
  tasks: AssistantTaskQueryItem[];
}

export interface AssistantTaskQueryResponse extends ResponseMeta {
  groups: AssistantTaskQueryGroup[];
}

export function parseAssistantTaskQueryResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): AssistantTaskQueryResponse {
  const resp = root.Response;
  const rawGroups = resp?.TaskGroup;
  const groupsArray: any[] = Array.isArray(rawGroups)
    ? rawGroups
    : rawGroups
    ? [rawGroups]
    : [];

  const groups: AssistantTaskQueryGroup[] = groupsArray.slice(0, 8).map((g) => {
    const no = Number(g?.["@_no"] ?? 0);
    const name = String(g?.["@_name"] ?? "");
    const rawTasks = g?.AssistantTask;
    const tasksArr: any[] = Array.isArray(rawTasks)
      ? rawTasks
      : rawTasks
      ? [rawTasks]
      : [];
    const tasks: AssistantTaskQueryItem[] = tasksArr.slice(0, 8).map((t) => ({
      no: Number(t?.["@_no"] ?? 0),
      text: String(t?.["@_text"] ?? ""),
      priority: Number(t?.["@_priority"] ?? 0),
    }));
    return { no, name, tasks };
  });

  return { ...meta, groups };
}
