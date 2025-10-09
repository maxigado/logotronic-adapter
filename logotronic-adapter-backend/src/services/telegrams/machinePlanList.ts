// src/service/machinePlanList.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for machinePlanList service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for machinePlanList service with response: ${xmlResponse}`
  );
}
