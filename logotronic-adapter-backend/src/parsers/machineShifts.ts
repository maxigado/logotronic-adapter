import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface MachineShiftEntry {
  shiftNo?: string | number;
  startDay?: string | number;
  startTime?: string;
  endTime?: string;
}

export interface MachineShiftDayEntry {
  value?: string | number; // ShiftDay value attribute
  shifts: MachineShiftEntry[];
}

export interface MachineShiftsResponse extends ResponseMeta {
  shiftCount?: number; // from Response@shiftCount
  days: MachineShiftDayEntry[]; // up to 7 days
}

function normalizeArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseMachineShiftsResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): MachineShiftsResponse {
  const resp = root.Response || {};
  const machineShifts = resp.MachineShifts || {};
  const shiftDaysRaw = normalizeArray<any>(machineShifts.ShiftDay);
  const days: MachineShiftDayEntry[] = [];
  for (let dIdx = 0; dIdx < shiftDaysRaw.length && dIdx < 7; dIdx++) {
    const sd = shiftDaysRaw[dIdx];
    const value = sd?.["@_value"];
    const shiftsRaw = normalizeArray<any>(sd.Shift);
    const shifts: MachineShiftEntry[] = [];
    for (let sIdx = 0; sIdx < shiftsRaw.length && sIdx < 3; sIdx++) {
      const sh = shiftsRaw[sIdx];
      shifts.push({
        shiftNo: sh?.["@_shiftNo"],
        startDay: sh?.["@_startDay"],
        startTime: sh?.["@_startTime"],
        endTime: sh?.["@_endTime"],
      });
    }
    days.push({ value, shifts });
  }
  const shiftCount =
    resp?.["@_shiftCount"] !== undefined
      ? Number(resp["@_shiftCount"])
      : undefined;
  return { ...meta, shiftCount, days };
}
