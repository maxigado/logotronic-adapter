// src/service/error.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for error service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for error service with response: ${xmlResponse}`
  );
}
