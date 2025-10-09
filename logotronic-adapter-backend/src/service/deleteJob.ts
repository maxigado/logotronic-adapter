// src/service/deleteJob.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for deleteJob service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for deleteJob service with response: ${xmlResponse}`);
}
