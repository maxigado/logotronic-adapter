// src/service/info.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for info service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for info service with response: ${xmlResponse}`
  );
}
