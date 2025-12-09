import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

/**
 * Interface for parsed jobInfo response data.
 * Extends ResponseMeta to include domain-specific fields.
 */
export interface JobInfoResponse extends ResponseMeta {
  orderNo?: string | number;
  prodNo?: string | number;
  jobNo?: string | number;
  planSpeed?: number;
  plusProduction?: number;
}

/**
 * Parser for jobInfo response (TypeID 10075).
 * Extracts nested Order > Prod > Job structure from XML response.
 *
 * Expected XML structure:
 * <Response typeId="10075" returnCode="1">
 *   <Order no="12345">
 *     <Prod no="4321">
 *       <Job no="4711" planSpeed="18550" plusProduction="250"/>
 *     </Prod>
 *   </Order>
 * </Response>
 */
export function parseJobInfoResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): JobInfoResponse {
  const resp = root.Response || {};

  // Navigate nested structure: Response > Order > Prod > Job
  const orderElement = resp.Order;
  const prodElement = orderElement?.Prod;
  const jobElement = prodElement?.Job;

  const result: JobInfoResponse = {
    ...meta,
  };

  // Extract Order number
  if (orderElement && orderElement["@_no"] !== undefined) {
    result.orderNo = orderElement["@_no"];
  }

  // Extract Prod number
  if (prodElement && prodElement["@_no"] !== undefined) {
    result.prodNo = prodElement["@_no"];
  }

  // Extract Job attributes
  if (jobElement) {
    if (jobElement["@_no"] !== undefined) {
      result.jobNo = jobElement["@_no"];
    }
    if (jobElement["@_planSpeed"] !== undefined) {
      result.planSpeed = parseInt(jobElement["@_planSpeed"], 10);
    }
    if (jobElement["@_plusProduction"] !== undefined) {
      result.plusProduction = parseInt(jobElement["@_plusProduction"], 10);
    }
  }

  return result;
}
