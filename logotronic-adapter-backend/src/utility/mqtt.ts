import * as mqtt from "mqtt";
import logger from "./logger";
import { IMessage, IPublishMessage } from "../dataset/common";
import { statusStoreInstance } from "../store/statusstore"; // StatusStore eklendi
import { tagStoreInstance } from "../store/tagstore";

class MQTTClient {
  public client: mqtt.MqttClient;
  constructor(
    brokerUrl: string,
    username: string,
    password: string,
    clientId: string
  ) {
    this.client = mqtt.connect(brokerUrl, {
      username: username,
      password: password,
      clientId: clientId,
      reconnectPeriod: 10000, // 10 seconds between automatic reconnect attempts
    });

    this.client.on("connect", () => {
      logger.info(`${clientId} is connected to MQTT broker at ${brokerUrl}`);
      statusStoreInstance.setDatabusStatus("connected"); // Status Güncellemesi
    });

    this.client.on("error", (error) => {
      logger.error(`${clientId} MQTT Client Error: ${error}`);
      statusStoreInstance.setDatabusStatus("error"); // Status Güncellemesi
    });

    this.client.on("reconnect", () => {
      logger.warn(
        `${clientId} reconnecting to MQTT broker (interval 10s configured).`
      );
    });

    this.client.on("close", () => {
      logger.warn(`${clientId} MQTT connection closed.`);
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });

    this.client.on("disconnect", (packet) => {
      logger.error(
        `${clientId} disconnected from MQTT broker. Reason: ${packet.reasonCode}`
      );
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });
  }

  public subscribe(topic: string) {
    this.client.subscribe(topic, (error) => {
      if (error) {
        logger.error("Error subscribing to topic:", error);
      } else {
        logger.info(`Subscribed to topic: ${topic}`);
      }
    });
  }

  public publish(topic: string, message: IPublishMessage) {
    // Create a deep copy to avoid modifying the original message object
    const processedMessage = JSON.parse(JSON.stringify(message));

    if (processedMessage.vals && Array.isArray(processedMessage.vals)) {
      processedMessage.vals.forEach((val: { id: string; val: any }) => {
        const tagData = tagStoreInstance.getTagDataById(val.id);
        if (tagData) {
          const originalValue = val.val;
          try {
            switch (tagData.dataType) {
              case "UDInt":
              case "UInt":
              case "DInt":
              case "ULInt":
              case "Byte":
              case "Char":
                val.val = parseInt(String(originalValue), 10);
                if (isNaN(val.val)) {
                  logger.warn(
                    `Value for ${tagData.name} (${originalValue}) could not be converted to an Integer. Using 0.`
                  );
                  val.val = 0;
                }
                break;
              case "LReal":
                val.val = parseFloat(String(originalValue));
                if (isNaN(val.val)) {
                  logger.warn(
                    `Value for ${tagData.name} (${originalValue}) could not be converted to a Float. Using 0.0.`
                  );
                  val.val = 0.0;
                }
                break;
              case "String":
                const strValue = String(originalValue);
                // Calculate extra bytes needed for UTF-8 vs Latin-1 encoding
                // Siemens S7 connector uses ISO-8859-1 (Latin-1) which is 1 byte per character
                // UTF-8 uses variable bytes: 1 byte (0-127), 2 bytes (128-2047), 3 bytes (2048-65535), 4 bytes (65536+)
                let extraBytes = 0;
                for (const char of strValue) {
                  const codePoint = char.codePointAt(0);
                  if (codePoint !== undefined) {
                    if (codePoint >= 128 && codePoint <= 2047) {
                      // 2-byte UTF-8 characters (includes ö, ü, ş, ğ, etc.)
                      extraBytes += 1;
                    } else if (codePoint >= 2048 && codePoint <= 65535) {
                      // 3-byte UTF-8 characters
                      extraBytes += 2;
                    } else if (codePoint >= 65536) {
                      // 4-byte UTF-8 characters (emojis, rare symbols)
                      extraBytes += 3;
                    }
                  }
                }
                // Append space padding equal to the extra UTF-8 bytes
                const paddedValue = strValue + " ".repeat(extraBytes);
                // Truncate to maximum 255 characters
                val.val = paddedValue.substring(0, 255);
                if (extraBytes > 0) {
                  logger.debug(
                    `String value for ${tagData.name} has ${extraBytes} extra UTF-8 byte(s). Added ${extraBytes} space(s) for padding. Final length: ${val.val.length}`
                  );
                }
                break;
              case "Bool":
                if (typeof originalValue === "string") {
                  val.val =
                    originalValue.toLowerCase() === "true" ||
                    originalValue === "1"
                      ? 1
                      : 0;
                } else {
                  val.val = Boolean(originalValue) ? 1 : 0;
                }
                break;
              default:
                logger.warn(
                  `Unhandled dataType ${tagData.dataType} for tag ${tagData.name}. Sending original value.`
                );
                break;
            }
            logger.debug(
              `Converted value for ${
                tagData.name
              } from ${originalValue} (${typeof originalValue}) to ${
                val.val
              } (${typeof val.val}) based on dataType ${tagData.dataType}`
            );
          } catch (error) {
            logger.error(
              `Error converting value for tag ${tagData.name} (ID: ${val.id}). Original value: ${originalValue}`,
              error
            );
            // Keep original value on error
            val.val = originalValue;
          }
        } else {
          logger.warn(
            `No tag definition found for ID: ${val.id}. Cannot perform type conversion.`
          );
        }
      });
    }

    const data = JSON.stringify(processedMessage);
    this.client.publish(topic, data, (error) => {
      if (error) {
        logger.error("Error publishing message:", error);
      } else {
        logger.debug(
          `Published to topic: ${topic} with data: ${JSON.stringify(
            processedMessage
          )}`
        );
      }
    });
  }
}

export default MQTTClient;
