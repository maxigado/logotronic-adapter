export interface IMessage {
  seq: number;
  vals: {
    id: string;
    qc: number;
    ts: string;
    val: boolean | string | number;
  }[];
}

export interface IPublishMessage {
  seq: number;
  vals: {
    id: string;
    val: boolean | string | number;
  }[];
}
