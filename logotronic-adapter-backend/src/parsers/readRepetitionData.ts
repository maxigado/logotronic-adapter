import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface ReadRepetitionDataParsed extends ResponseMeta {
  preset?: number | string;
  repro?: number | string;
  workplaceName?: string;
  rawDataBytes?: number[]; // 0-255 per byte
}

export function parseReadRepetitionDataResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): ReadRepetitionDataParsed {
  const resp = root.Response || {};
  const rrd = resp.ReadRepetitionData;
  let preset: number | string | undefined;
  let repro: number | string | undefined;
  let workplaceName: string | undefined;
  let rawDataBytes: number[] | undefined;

  if (rrd) {
    // Variant 1: attributes present
    if (
      rrd["@_preset"] !== undefined ||
      rrd["@_repro"] !== undefined ||
      rrd["@_workplaceName"] !== undefined
    ) {
      preset = rrd["@_preset"]; // may already be number due to fast-xml-parser
      repro = rrd["@_repro"];
      workplaceName = rrd["@_workplaceName"];
    }
    // Variant 2: raw data inside element text/CDATA
    // If rrd is string or has #text property representing raw bytes sequence.
    let rawText: string | undefined;
    if (typeof rrd === "string") rawText = rrd.trim();
    else if (rrd["#text"]) rawText = String(rrd["#text"]).trim();

    if (
      rawText &&
      rawText.length > 0 &&
      preset === undefined &&
      repro === undefined &&
      workplaceName === undefined
    ) {
      // Parse comma-separated numeric values (e.g., "0,22,3,55,6,77,88...")
      rawDataBytes = rawText
        .split(",")
        .map((val) => Number(val.trim()))
        .filter((num) => !isNaN(num))
        .slice(0, 2048); // limit to 2048 values
    }
  }

  return { ...meta, preset, repro, workplaceName, rawDataBytes };
}
