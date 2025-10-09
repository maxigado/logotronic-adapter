// src/dataset/metadata.ts

export interface IDataPointDefinition {
  accessMode: string;
  acquisitionCycleInMs?: number;
  acquisitionMode?: string;
  dataType: string;
  id: string;
  name: string;
}

export interface IDataPoints {
  dataPointDefinitions: IDataPointDefinition[];
  name: string;
  publishType: string;
  pubTopic: string;
  topic: string;
}

export interface IConnection {
  dataPoints: IDataPoints[];
  name: string;
  type: string;
}

/**
 * PLC'den gelen tam metaveri mesajının yapısı.
 */
export interface IMetadataMessage {
  applicationName: string;
  connections: IConnection[];
  hashVersion: number;
  seq: number;
  statustopic: string;
}
