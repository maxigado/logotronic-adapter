// src/service/prodHeadDataExchange.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for prodHeadDataExchange service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for prodHeadDataExchange service with response: ${xmlResponse}`);
}
