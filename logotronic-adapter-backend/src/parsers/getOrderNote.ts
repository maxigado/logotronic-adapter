import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface GetOrderNoteResponse extends ResponseMeta {
  orderNote?: string;
  productionOutput?: number | string;
  energyLevel?: number | string;
  energyMachine?: number | string;
}

export function parseGetOrderNoteResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): GetOrderNoteResponse {
  const resp = root.Response || {};

  // Handle new format: <OrderNote>text</OrderNote>
  const orderNote = resp.OrderNote;

  // Handle old format with attributes
  const productionOutput = resp["@_productionOutput"];
  const energyLevel = resp["@_energyLevel"];
  const energyMachine = resp["@_energyMachine"];

  return {
    ...meta,
    orderNote: typeof orderNote === "string" ? orderNote : undefined,
    productionOutput,
    energyLevel,
    energyMachine,
  };
}
