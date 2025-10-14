// src/service/info.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Info service has no Logotronic Request. Info Response will be received once Logotronic send additional information"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for info service with response: ${xmlResponse}`
  );
}
