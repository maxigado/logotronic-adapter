import { write } from "fs";

// export const config = {
//   application: {
//     port: 3000,
//   },
//   databus: {
//     url: "mqtt://ie-databus",
//     username: "edge",
//     password: "edge",
//     client: "S7Connector",
//     topic: {
//       read: "ie/d/j/simatic/v1/s7c1/dp/r/plc/default",
//       write: "ie/d/j/simatic/v1/s7c1/dp/w/plc",
//       metadata: "ie/m/j/simatic/v1/s7c1/dp",
//       update: "ie/c/j/simatic/v1/updaterequest",
//       status: "ie/d/j/simatic/v1/s7c1/status",
//     },
//   },
//   database: {
//     host: "tubtraceability-database",
//     database: "tubtraceability",
//     user: "bsh",
//     password: "Sunrise12345.",
//   },
//   logotronicserver: {
//     host: "192.168.0.166",
//     port: 64001,
//   },
// };

export const config = {
  application: {
    port: 3000,
  },
  databus: {
    url: "mqtt://localhost",
    username: "edge",
    password: "edge",
    client: "S7Connector",
    topic: {
      read: "ie/d/j/simatic/v1/s7c1/dp/r/plc/default",
      write: "ie/d/j/simatic/v1/s7c1/dp/w/plc",
      metadata: "ie/m/j/simatic/v1/s7c1/dp",
      update: "ie/c/j/simatic/v1/updaterequest",
      status: "ie/d/j/simatic/v1/s7c1/status",
    },
  },
  database: {
    host: "tubtraceability-database",
    database: "tubtraceability",
    user: "bsh",
    password: "Sunrise12345.",
  },
  logotronicserver: {
    host: "localhost",
    port: 64001,
  },
};
