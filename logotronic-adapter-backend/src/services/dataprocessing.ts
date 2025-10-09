// src/service/dataprocessing.ts

import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import TCPClient from "../utility/tcp";

import logger from "../utility/logger";
import { IMetadataMessage } from "../dataset/metadata";
import { tagStoreInstance, ITagData } from "../store/tagstore";
import { IStatusMessage } from "../dataset/status";
import { statusStoreInstance } from "../store/statusstore";

// --- Tip Tanımları ---
type LogotronicRequestBuilder = (message: any) => void;
type LogotronicResponseHandler = (xmlResponse: string) => void;

// XML parsing için minimal yardımcı fonksiyon (fast-xml-parser yerine)
const getXmlTypeID = (xml: string): string | null => {
  // <Response typeld="XXXXX"...> formatını arar
  const match = xml.match(/<Response.*?typeld="(\d+)"/i);
  return match ? match[1] : null;
};

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
    // Telegram TypeID'leri (Logotronic Rapida Protocol.pdf'ten veya mock)
    "10010": disconnectHandler, // XML Disconnect
    "10011": operationalDataHandler, // XML OperationalData
    "10012": userEventHandler, // XML UserEvent
    "10015": assistantTaskHandler, // XML Assistant Task
    "10030": assistantTaskQueryHandler, // XML Assistant Tasks (Query)
    "10036": personnelHandler, // XML Personnel (Query)
    "10037": userEventsQueryHandler, // XML UserEvents (Query)
    "10038": createChangePersonnelHandler, // XML CreateOrChange Personnel
    "10049": readRepetitionDataHandler, // XML ReadRepetitionData
    "10050": saveRepetitionDataHandler, // XML SaveRepetitionData
    "10060": jobListHandler, // XML JobList
    "10061": jobPlanHandler, // XML PlanList
    "10063": createJobHandler, // XML CreateJob
    "10006": getOrderNoteHandler, // XML GetOrderNote
    "10007": setOrderNoteHandler, // XML SetOrderNote
    "10093": previewHandler, // XML preview (Option B)
    "10008": bdePersonnelHandler, // XML BdePersonnel
    "10165": deleteJobHandler, // XML DeleteJob
    "10111": machineShiftsHandler, // XML MachineShifts
    "10068": machinePlanListHandler, // XML Machine PlanList
    "11010": orderHeadDataExchangeHandler, // XML OrderHeadDataExchange
    "11020": prodHeadDataExchangeHandler, // XML PartOrderHeadDataExchange
    "11030": jobHeadDataExchangeHandler, // XML PrintRunHeadDataExchange

    // Kullanıcı tarafından sağlanan mock TypeID'ler
    "99901": acceptHandler,
    "99902": workplaceSetupHandler,
    "99903": workplaceInfoHandler,
    "99904": versionInfoHandler,
    "99905": timeRequestHandler,
    "99906": infoHandler,
    "99907": errorHandler,
    "99908": errorTextHandler,
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
  // tagStoreInstance.updateValues(message);

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
  // 1. Buffer'ı UTF-8 string'e çevir
  const xmlResponse = data.toString("utf8");
  logger.info("Processing Logotronic XML Response: " + xmlResponse);

  // 2. ve 3. XML'i parse et ve typeId'yi al
  const typeId = getXmlTypeID(xmlResponse);

  if (typeId) {
    // 4. ve 5. TypeID'yi eşleştir ve ilgili Handler'ı çağır
    const handlerFunction = serviceResponseHandlers[typeId];

    if (handlerFunction) {
      logger.info(
        `Handler found for TypeID: ${typeId}. Calling Logotronic Response Handler.`
      );
      handlerFunction(xmlResponse);
    } else {
      logger.warn(
        `No specific handler found for Logotronic Response TypeID: ${typeId}`
      );
    }
  } else {
    logger.error("Could not extract TypeID from Logotronic XML response.");
  }
}
