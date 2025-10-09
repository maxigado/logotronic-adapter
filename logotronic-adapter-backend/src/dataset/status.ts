// src/dataset/status.ts

export type ConnectionStatus = "connected" | "disconnected" | "error";
export type DatabusStatus = "connected" | "disconnected" | "error";
export type LogotronicStatus = "connected" | "disconnected" | "error";

/**
 * Makineden (MQTT status topic) gelen mesaj yapısının bir bölümü.
 */
export interface IStatusMessage {
  connections: { name: string; status: string }[];
  connector: { status: string }; // Databus üzerinde çalışan S7 Connector durumu
  seq: number;
  ts: string;
}

/**
 * StatusStore'da tutulan ve frontend'e gönderilen genel status objesi.
 */
export interface IStatusData {
  databus: DatabusStatus; // MQTT Client (Databus) bağlantı durumu
  logotronic: LogotronicStatus; // TCP Client (Logotronic Server) bağlantı durumu
  connector: ConnectionStatus; // MQTT Broker'a bağlı S7 Connector'ün durumu
  [key: string]: ConnectionStatus | DatabusStatus | LogotronicStatus; // Dinamik olarak eklenen machineName: status
}
