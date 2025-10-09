// src/service/getOrderNote.ts
import logger from "../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for getOrderNote service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(`Logotronic Response Handler is called for getOrderNote service with response: ${xmlResponse}`);
}
