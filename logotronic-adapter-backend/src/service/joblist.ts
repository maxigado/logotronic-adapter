// src/service/jobList.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for jobList service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for jobList service with response: ${xmlResponse}`);
}
