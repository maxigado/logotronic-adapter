import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface JobListJobEntry {
  // Order level
  orderNo?: string | number;
  orderName?: string;
  customerNo?: string | number;
  customerName?: string;
  deliveryDate?: string;
  // Prod level
  prodNo?: string | number;
  prodName?: string;
  prodPaperNo?: string | number;
  prodPaperName?: string;
  prodPaperThickness?: string | number;
  prodAmount?: string | number;
  // Job level
  jobNo?: string | number;
  jobName?: string;
  jobAmount?: string | number;
  jobMinAmount?: string | number;
  jobMaxAmount?: string | number;
  subsidy?: string | number;
  subsidy2?: string | number;
  copy?: string | number;
  status?: string | number;
  setupTime?: string | number;
  printTime?: string | number;
  planStart?: string;
  workplaceId?: string | number;
  separations?: string;
  repro?: string | number; // XML attribute name is repro
  planningState?: string | number;
  priority?: string | number;
  workPreparation?: string; // string space-separated numbers per sample
  // Optional extended attributes (examples: startupWaste, grossCopies, netCopies, markOrDetect)
  startupWaste?: string | number;
  grossCopies?: string | number;
  netCopies?: string | number;
  markOrDetect?: string | number;
}

export interface JobListResponse extends ResponseMeta {
  jobs: JobListJobEntry[];
}

function normalizeArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseJobListResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): JobListResponse {
  const resp = root.Response || {};
  const ordersRaw = normalizeArray<any>(resp.Order);
  const jobs: JobListJobEntry[] = [];
  for (const order of ordersRaw) {
    const orderNo = order["@_no"];
    const orderName = order["@_name"];
    const customerNo = order["@_customerNo"];
    const customerName = order["@_customerName"];
    const deliveryDate = order["@_deliveryDate"];
    const prodsRaw = normalizeArray<any>(order.Prod);
    for (const prod of prodsRaw) {
      const prodNo = prod["@_no"];
      const prodName = prod["@_name"];
      const prodAmount = prod["@_amount"];
      const prodPaperNo = prod["@_paperNo"];
      const prodPaperName = prod["@_paperName"];
      const prodPaperThickness =
        prod["@_paperThickness"] ?? prod["@_paperTickness"]; // handle possible typo
      const jobsRaw = normalizeArray<any>(prod.Job);
      for (const job of jobsRaw) {
        const jobEntry: JobListJobEntry = {
          orderNo,
          orderName,
          customerNo,
          customerName,
          deliveryDate,
          prodNo,
          prodName,
          prodPaperNo,
          prodPaperName,
          prodPaperThickness,
          prodAmount,
          jobNo: job["@_no"],
          jobName: job["@_name"],
          jobAmount: job["@_amount"],
          jobMinAmount: job["@_minAmount"],
          jobMaxAmount: job["@_maxAmount"],
          subsidy: job["@_subsidy"],
          subsidy2: job["@_subsidy2"],
          copy: job["@_copy"],
          status: job["@_status"],
          setupTime: job["@_setupTime"],
          printTime: job["@_printTime"],
          planStart: job["@_planStart"],
          workplaceId: job["@_workplaceId"],
          separations: job["@_separations"],
          repro: job["@_repro"],
          planningState: job["@_planningState"],
          priority: job["@_priority"],
          workPreparation: job["@_workPreparation"],
          startupWaste: job["@_startupWaste"],
          grossCopies: job["@_grossCopies"],
          netCopies: job["@_netCopies"],
          markOrDetect: job["@_markOrDetect"],
        };
        jobs.push(jobEntry);
        if (jobs.length >= 51) break; // limit to 51 jobs
      }
      if (jobs.length >= 51) break;
    }
    if (jobs.length >= 51) break;
  }
  return { ...meta, jobs };
}
