import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface GetOrderNoteResponse extends ResponseMeta {
  productionOutput?: number | string;
  energyLevel?: number | string;
  energyMachine?: number | string;
}

export function parseGetOrderNoteResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): GetOrderNoteResponse {
  const resp = root.Response || {};
  const productionOutput = resp["@_productionOutput"];
  const energyLevel = resp["@_energyLevel"];
  const energyMachine = resp["@_energyMachine"];
  return {
    ...meta,
    productionOutput,
    energyLevel,
    energyMachine,
  };
}
