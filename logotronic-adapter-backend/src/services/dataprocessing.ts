// src/service/dataprocessing.ts

import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import TCPClient from "../utility/tcp";

import logger from "../utility/logger";
import { IMetadataMessage } from "../dataset/metadata";
import { tagStoreInstance, ITagData } from "../store/tagstore";
import { IStatusMessage } from "../dataset/status";
import { statusStoreInstance } from "../store/statusstore";
import { rapidaTypeIds } from "../dataset/typeid";

// --- Tip Tanımları ---
type LogotronicRequestBuilder = (message: any) => void;
type LogotronicResponseHandler = (responseBody: Buffer) => void;

// --- Logotronic Servis Importları (Builders - Request) ---
import {
  logotronicRequestBuilder as acceptBuilder,
  logotronicResponseHandler as acceptHandler,
} from "./telegrams/accept";
import {
  logotronicRequestBuilder as assistantTaskBuilder,
  logotronicResponseHandler as assistantTaskHandler,
} from "./telegrams/assistantTask";
import {
  logotronicRequestBuilder as assistantTaskQueryBuilder,
  logotronicResponseHandler as assistantTaskQueryHandler,
} from "./telegrams/assistantTaskQuery";
import {
  logotronicRequestBuilder as bdePersonnelBuilder,
  logotronicResponseHandler as bdePersonnelHandler,
} from "./telegrams/bdePersonnel";
import {
  logotronicRequestBuilder as createChangePersonnelBuilder,
  logotronicResponseHandler as createChangePersonnelHandler,
} from "./telegrams/createChangePersonnel";
import {
  logotronicRequestBuilder as createJobBuilder,
  logotronicResponseHandler as createJobHandler,
} from "./telegrams/createJob";
import {
  logotronicRequestBuilder as deleteJobBuilder,
  logotronicResponseHandler as deleteJobHandler,
} from "./telegrams/deleteJob";
import {
  logotronicRequestBuilder as disconnectBuilder,
  logotronicResponseHandler as disconnectHandler,
} from "./telegrams/disconnect";
import {
  logotronicRequestBuilder as errorBuilder,
  logotronicResponseHandler as errorHandler,
} from "./telegrams/error";
import {
  logotronicRequestBuilder as errorTextBuilder,
  logotronicResponseHandler as errorTextHandler,
} from "./telegrams/errorText";
import {
  logotronicRequestBuilder as getOrderNoteBuilder,
  logotronicResponseHandler as getOrderNoteHandler,
} from "./telegrams/getOrderNote";
import {
  logotronicRequestBuilder as infoBuilder,
  logotronicResponseHandler as infoHandler,
} from "./telegrams/info";
import {
  logotronicRequestBuilder as jobHeadDataExchangeBuilder,
  logotronicResponseHandler as jobHeadDataExchangeHandler,
} from "./telegrams/jobHeadDataExchange";
import {
  logotronicRequestBuilder as jobListBuilder,
  logotronicResponseHandler as jobListHandler,
} from "./telegrams/jobList";
import {
  logotronicRequestBuilder as jobPlanBuilder,
  logotronicResponseHandler as jobPlanHandler,
} from "./telegrams/jobPlan";
import {
  logotronicRequestBuilder as machinePlanListBuilder,
  logotronicResponseHandler as machinePlanListHandler,
} from "./telegrams/machinePlanList";
import {
  logotronicRequestBuilder as machineShiftsBuilder,
  logotronicResponseHandler as machineShiftsHandler,
} from "./telegrams/machineShifts";
import {
  logotronicRequestBuilder as operationalDataBuilder,
  logotronicResponseHandler as operationalDataHandler,
} from "./telegrams/operationalData";
import {
  logotronicRequestBuilder as orderHeadDataExchangeBuilder,
  logotronicResponseHandler as orderHeadDataExchangeHandler,
} from "./telegrams/orderHeadDataExchange";
import {
  logotronicRequestBuilder as personnelBuilder,
  logotronicResponseHandler as personnelHandler,
} from "./telegrams/personnel";
import {
  logotronicRequestBuilder as previewBuilder,
  logotronicResponseHandler as previewHandler,
} from "./telegrams/preview";
import {
  logotronicRequestBuilder as prodHeadDataExchangeBuilder,
  logotronicResponseHandler as prodHeadDataExchangeHandler,
} from "./telegrams/prodHeadDataExchange";
import {
  logotronicRequestBuilder as readRepetitionDataBuilder,
  logotronicResponseHandler as readRepetitionDataHandler,
} from "./telegrams/readRepetitionData";
import {
  logotronicRequestBuilder as saveRepetitionDataBuilder,
  logotronicResponseHandler as saveRepetitionDataHandler,
} from "./telegrams/saveRepetitionData";
import {
  logotronicRequestBuilder as setOrderNoteBuilder,
  logotronicResponseHandler as setOrderNoteHandler,
} from "./telegrams/setOrderNote";
import {
  logotronicRequestBuilder as timeRequestBuilder,
  logotronicResponseHandler as timeRequestHandler,
} from "./telegrams/timeRequest";
import {
  logotronicRequestBuilder as userEventBuilder,
  logotronicResponseHandler as userEventHandler,
} from "./telegrams/userEvent";
import {
  logotronicRequestBuilder as userEventsQueryBuilder,
  logotronicResponseHandler as userEventsQueryHandler,
} from "./telegrams/userEventsQuery";
import {
  logotronicRequestBuilder as versionInfoBuilder,
  logotronicResponseHandler as versionInfoHandler,
} from "./telegrams/versionInfo";
import {
  logotronicRequestBuilder as workplaceInfoBuilder,
  logotronicResponseHandler as workplaceInfoHandler,
} from "./telegrams/workplaceInfo";
import {
  logotronicRequestBuilder as workplaceSetupBuilder,
  logotronicResponseHandler as workplaceSetupHandler,
} from "./telegrams/workplaceSetup";

// --- Servis Eşleştirmeleri ---

// Aşama 1: MQTT Tetikleyici Tag - Request Builder Eşleştirmesi
const serviceRequestTriggers: { [tagName: string]: LogotronicRequestBuilder } =
  {
    "LTA-Data.accept.command.execute": acceptBuilder,
    "LTA-Data.workplaceSetup.command.execute": workplaceSetupBuilder,
    "LTA-Data.workplaceInfo.command.execute": workplaceInfoBuilder,
    "LTA-Data.versionInfo.command.execute": versionInfoBuilder,
    "LTA-Data.timeRequest.command.execute": timeRequestBuilder,
    "LTA-Data.info.command.execute": infoBuilder,
    "LTA-Data.error.command.execute": errorBuilder,
    "LTA-Data.errorText.command.execute": errorTextBuilder,
    "LTA-Data.disconnect.command.execute": disconnectBuilder,
    "LTA-Data.jobList.command.execute": jobListBuilder,
    "LTA-Data.jobPlan.command.execute": jobPlanBuilder,
    "LTA-Data.machinePlanList.command.execute": machinePlanListBuilder,
    "LTA-Data.getOrderNote.command.execute": getOrderNoteBuilder,
    "LTA-Data.setOrderNote.command.execute": setOrderNoteBuilder,
    "LTA-Data.createJob.command.execute": createJobBuilder,
    "LTA-Data.deleteJob.command.execute": deleteJobBuilder,
    "LTA-Data.preview.command.execute": previewBuilder,
    "LTA-Data.operationalData.command.execute": operationalDataBuilder,
    "LTA-Data.userEventsQuery.command.execute": userEventsQueryBuilder,
    "LTA-Data.userEvent.command.execute": userEventBuilder,
    "LTA-Data.assistantTaskQuery.command.execute": assistantTaskQueryBuilder,
    "LTA-Data.assistantTask.command.execute": assistantTaskBuilder,
    "LTA-Data.bdePersonnel.command.execute": bdePersonnelBuilder,
    "LTA-Data.personnel.command.execute": personnelBuilder,
    "LTA-Data.createChangePersonnel.command.execute":
      createChangePersonnelBuilder,
    "LTA-Data.machineShifts.command.execute": machineShiftsBuilder,
    "LTA-Data.readRepetitionData.command.execute": readRepetitionDataBuilder,
    "LTA-Data.saveRepetitionData.command.execute": saveRepetitionDataBuilder,
    "LTA-Data.orderHeadDataExchange.command.execute":
      orderHeadDataExchangeBuilder,
    "LTA-Data.prodHeadDataExchange.command.execute":
      prodHeadDataExchangeBuilder,
    "LTA-Data.jobHeadDataExchange.command.execute": jobHeadDataExchangeBuilder,
  };

// Aşama 2: Logotronic Response TypeID - Response Handler Eşleştirmesi
const serviceResponseHandlers: { [typeId: string]: LogotronicResponseHandler } =
  {
    [rapidaTypeIds.disconnect]: disconnectHandler,
    [rapidaTypeIds.operationalData]: operationalDataHandler,
    [rapidaTypeIds.userEvent]: userEventHandler,
    [rapidaTypeIds.assistantTask]: assistantTaskHandler,
    [rapidaTypeIds.assistantTaskQuery]: assistantTaskQueryHandler,
    [rapidaTypeIds.personnel]: personnelHandler,
    [rapidaTypeIds.userEventsQuery]: userEventsQueryHandler,
    [rapidaTypeIds.createChangePersonnel]: createChangePersonnelHandler,
    [rapidaTypeIds.readRepetitionData]: readRepetitionDataHandler,
    [rapidaTypeIds.saveRepetitionData]: saveRepetitionDataHandler,
    [rapidaTypeIds.jobList]: jobListHandler,
    [rapidaTypeIds.jobPlan]: jobPlanHandler,
    [rapidaTypeIds.createJob]: createJobHandler,
    [rapidaTypeIds.getOrderNote]: getOrderNoteHandler,
    [rapidaTypeIds.setOrderNote]: setOrderNoteHandler,
    [rapidaTypeIds.preview]: previewHandler,
    [rapidaTypeIds.bdePersonnel]: bdePersonnelHandler,
    [rapidaTypeIds.deleteJob]: deleteJobHandler,
    [rapidaTypeIds.machineShifts]: machineShiftsHandler,
    [rapidaTypeIds.machinePlanList]: machinePlanListHandler,
    [rapidaTypeIds.orderHeadDataExchange]: orderHeadDataExchangeHandler,
    [rapidaTypeIds.prodHeadDataExchange]: prodHeadDataExchangeHandler,
    [rapidaTypeIds.jobHeadDataExchange]: jobHeadDataExchangeHandler,
    [rapidaTypeIds.accept]: acceptHandler,
    [rapidaTypeIds.workplaceSetup]: workplaceSetupHandler,
    [rapidaTypeIds.workplaceInfo]: workplaceInfoHandler,
    [rapidaTypeIds.versionInfo]: versionInfoHandler,
    [rapidaTypeIds.timeRequest]: timeRequestHandler,
    [rapidaTypeIds.info]: infoHandler,
    [rapidaTypeIds.error]: errorHandler,
    [rapidaTypeIds.errorText]: errorTextHandler,
  };

export let mqttClientInstance: MQTTClient;
export let tcpClientInstance: TCPClient;

const dataprocessing = {
  initdataprocessing() {
    logger.info("Initialize Data Processing Service");
    try {
      mqttClientInstance = new MQTTClient(
        config.databus.url,
        config.databus.username,
        config.databus.password,
        config.databus.client
      );

      logger.info("Trying to connect Databus");

      mqttClientInstance.client.on("connect", () => {
        logger.info("MQTT Client is connected to Databus");
        mqttClientInstance.subscribe(config.databus.topic.read);
        mqttClientInstance.subscribe(config.databus.topic.status);
        mqttClientInstance.subscribe(config.databus.topic.metadata);
        setTimeout(() => {
          MQTTLister();
        }, 1000);
      });

      logger.info("Trying to connect Logotronic Server");
      tcpClientInstance = new TCPClient(
        config.logotronicserver.host,
        config.logotronicserver.port,
        "LogotronicServer"
      );

      tcpClientInstance.client.on("connect", () => {
        logger.info("TCP Client is connected to Logotronic Server");
        TCPListener();
      });
      tcpClientInstance.connect();
    } catch (error) {
      logger.error(error);
    }
  },
};
export default dataprocessing;

function MQTTLister() {
  mqttClientInstance.client.on("message", (topic, data) => {
    try {
      // Mesajı json olarak parse et (tip kontrolü fonksiyonlar içinde yapılacaktır)
      const message = JSON.parse(data.toString());

      if (topic === config.databus.topic.status) {
        logger.info(`Received status message from topic: ${topic}`);
        // Status mesajları için IMessage tipini kullan
        processStatusMessage(message as IStatusMessage, topic);
      } else if (topic === config.databus.topic.metadata) {
        logger.info(`Received metadata message from topic: ${topic}`);
        // Metadata mesajları için yeni IMetadataMessage tipini kullan
        processMetadataMessage(message as IMetadataMessage, topic);
      } else if (topic === config.databus.topic.read) {
        logger.debug(`Received message from data topic: ${topic}`);
        // Data mesajları için TagStore güncelleme fonksiyonunu çağır
        processMachineMessage(message, topic);
      } else {
        logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error parsing MQTT message from topic ${topic}:`, error);
      console.log(error);
    }
  });
}

function TCPListener() {
  tcpClientInstance.client.on("data", (data: Buffer) => {
    logger.info(
      `Received raw TCP data from Logotronic Server. Length: ${data.length}`
    );
    processLogotricResponse(data);
  });
}

function processStatusMessage(message: IStatusMessage, topic: string) {
  logger.info(`Processing status message:`, message);
  statusStoreInstance.updateMachineStatus(message);
}

function processMetadataMessage(message: IMetadataMessage, topic: string) {
  logger.info(`Processing metadata message:`, message);
  tagStoreInstance.initialize(message);
  setTimeout(() => {
    const updateRequestTopic = config.databus.topic.update;
    const updateRequestMessage: any = { Path: "s7c1" };
    mqttClientInstance.publish(updateRequestTopic, updateRequestMessage);
  }, 2000);
}

// **Aşama 1: MQTT Mesajlarını İşleme**
function processMachineMessage(message: any, topic: string) {
  logger.debug(`Processing machine data message from topic ${topic}.`);
  // 1. Gelen değerlerle TagStore'u güncelle
  tagStoreInstance.updateValues(message);

  const triggerTagsMap = new Map<string, LogotronicRequestBuilder>();

  // 2. ve 3. Eşleşme kontrolü için tüm trigger taglerinin ID'lerini bir Map'e önbelleğe al
  for (const tagName in serviceRequestTriggers) {
    const tagData: ITagData | undefined =
      tagStoreInstance.getTagDataByTagName(tagName);
    if (tagData) {
      // Map'i Tag ID'sini key, Builder fonksiyonunu value olarak kullanacak şekilde oluştur
      triggerTagsMap.set(tagData.id, serviceRequestTriggers[tagName]);
    }
  }

  // 4. Gelen mesajdaki her bir değeri kontrol et
  const records = message?.records as any[];
  if (!records || records.length === 0 || !records[0]?.vals) {
    logger.warn(
      "Received data message has no valid records to check triggers."
    );
    return;
  }

  const vals = records[0].vals;

  for (const val of vals) {
    // Sadece boolean ve true olan sinyalleri kontrol et
    if (val.val === true) {
      const builderFunction = triggerTagsMap.get(val.id);
      if (builderFunction) {
        // 5. Eşleşme varsa, ilgili Builder fonksiyonunu çağır
        const triggeringTagName = Array.from(
          tagStoreInstance.getAllTagData()
        ).find((tag) => tag.id === val.id)?.name;
        logger.debug(
          `Trigger found for Tag ID: ${val.id} (${triggeringTagName}). Calling Logotronic Request Builder.`
        );
        builderFunction(message);
      }
    }
  }
}

// **Aşama 2: TCP Yanıtlarını İşleme**
function processLogotricResponse(data: Buffer) {
  const HEADER_SIZE = 24;
  const FOOTER_SIZE = 20;

  // 1. Check if buffer is long enough for the header
  if (data.length < HEADER_SIZE) {
    logger.error(
      `Received data is too short to be a valid Logotronic frame. Length: ${data.length}`
    );
    return;
  }

  // 2. Read TypeID from the header
  // Try reading as a string for "ACCEPT"
  let typeId: string | undefined;
  try {
    const typeIdStr = data.toString("utf8", 16, 20).trim();
    if (typeIdStr === "ACCE") {
      // Checking for "ACCE" as it might be part of "ACCEPT"
      const fullTypeIdStr = data.toString("utf8", 16, 22).trim();
      if (fullTypeIdStr.startsWith("ACCEPT")) {
        typeId = "ACCEPT";
      }
    }
  } catch (e) {
    // If string parsing fails, it's likely a numeric ID.
  }

  // If not "ACCEPT", read as a number
  if (!typeId) {
    try {
      typeId = data.readUInt32BE(16).toString();
    } catch (error) {
      logger.error(
        "Could not extract TypeID from Logotronic response header.",
        error
      );
      return;
    }
  }

  // 3. Read dataLength from the header (offset 20, UInt32BE)
  const dataLength = data.readUInt32BE(20);

  // 4. Check if the full frame is received
  if (data.length < HEADER_SIZE + dataLength + FOOTER_SIZE) {
    logger.warn(
      `Incomplete frame received. Expected ${
        HEADER_SIZE + dataLength + FOOTER_SIZE
      }, got ${data.length}`
    );
    // TODO: Buffer incomplete data and wait for the rest.
    return; // Return to avoid processing incomplete data
  }

  // 5. Extract the body
  const bodyBuffer = data.slice(HEADER_SIZE, HEADER_SIZE + dataLength);

  // For now, assume the body is XML as handlers expect a string.
  // This might need to be changed later to fully support binary bodies.
  const bodyString = bodyBuffer.toString("utf8");

  logger.info(`Processing Logotronic Response. TypeID: ${typeId}`);
  logger.info("Response Body: " + bodyString);

  if (typeId) {
    const handlerFunction = serviceResponseHandlers[typeId];

    if (handlerFunction) {
      logger.info(
        `Handler found for TypeID: ${typeId}. Calling Logotronic Response Handler.`
      );
      handlerFunction(bodyBuffer); // Pass the body string to the handler
    } else {
      logger.warn(
        `No specific handler found for Logotronic Response TypeID: ${typeId}`
      );
    }
  } else {
    // This case should not happen if we read the typeId from the header.
    logger.error("Could not extract TypeID from Logotronic response header.");
  }
}
