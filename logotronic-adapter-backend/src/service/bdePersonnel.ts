// src/service/bdePersonnel.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for bdePersonnel service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for bdePersonnel service with response: ${xmlResponse}`);
}
