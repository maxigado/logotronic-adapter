// src/service/setOrderNote.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for setOrderNote service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for setOrderNote service with response: ${xmlResponse}`
  );
}
