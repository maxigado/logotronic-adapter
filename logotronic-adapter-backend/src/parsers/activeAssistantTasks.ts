import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

/**
 * Interface for a single assistant task item.
 */
export interface ActiveAssistantTaskItem {
  no: number;
  text: string;
  priority: number;
  kind: string;
  groupNo: number;
  workingTaskId?: number; // Optional
  parameter?: string; // Optional
  comment?: string; // Optional
}

/**
 * Interface for parsed activeAssistantTasks response data.
 * Extends ResponseMeta to include domain-specific fields.
 */
export interface ActiveAssistantTasksResponse extends ResponseMeta {
  tasks: ActiveAssistantTaskItem[];
}

/**
 * Helper function to normalize single item or array to array.
 */
function normalizeArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Parser for activeAssistantTasks response (TypeID 10404).
 * Extracts flat array of AssistantTask elements from XML response.
 *
 * Expected XML structure:
 * <Response typeId="10404" returnCode="1">
 *   <AssistantTask no="10" text="Make coffee" priority="1" kind="Resource" groupNo="5" />
 *   <AssistantTask no="18" text="Get new paper" priority="7" kind="Resource" groupNo="5"
 *                  workingTaskId="123" parameter="B4" comment="Type B4"/>
 * </Response>
 */
export function parseActiveAssistantTasksResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): ActiveAssistantTasksResponse {
  const resp = root.Response || {};

  // Get AssistantTask elements (could be single or array)
  const rawTasks = normalizeArray<any>(resp.AssistantTask);

  // Map up to 16 tasks
  const tasks: ActiveAssistantTaskItem[] = rawTasks
    .slice(0, 16)
    .map((t: any) => ({
      no: Number(t?.["@_no"] ?? 0),
      text: String(t?.["@_text"] ?? ""),
      priority: Number(t?.["@_priority"] ?? 0),
      kind: String(t?.["@_kind"] ?? ""),
      groupNo: Number(t?.["@_groupNo"] ?? 0),
      // Optional attributes - only include if present in XML
      ...(t?.["@_workingTaskId"] !== undefined && {
        workingTaskId: Number(t["@_workingTaskId"]),
      }),
      ...(t?.["@_parameter"] !== undefined && {
        parameter: String(t["@_parameter"]),
      }),
      ...(t?.["@_comment"] !== undefined && {
        comment: String(t["@_comment"]),
      }),
    }));

  return { ...meta, tasks };
}
