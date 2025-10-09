// src/service/createChangePersonnel.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for createChangePersonnel service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for createChangePersonnel service with response: ${xmlResponse}`);
}
