// src/service/preview.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for preview service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for preview service with response: ${xmlResponse}`
  );
}
