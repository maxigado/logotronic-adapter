import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface OperationalDataResponse extends ResponseMeta {
  productionOutput?: number;
  energyLevel?: number;
  energyMachine?: number;
}

export function parseOperationalDataResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): OperationalDataResponse {
  const resp = root.Response;
  const productionOutput = resp?.["@_productionOutput"];
  const energyLevel = resp?.["@_energyLevel"];
  const energyMachine = resp?.["@_energyMachine"];

  return {
    ...meta,
    productionOutput:
      productionOutput !== undefined ? Number(productionOutput) : undefined,
    energyLevel: energyLevel !== undefined ? Number(energyLevel) : undefined,
    energyMachine:
      energyMachine !== undefined ? Number(energyMachine) : undefined,
  };
}
