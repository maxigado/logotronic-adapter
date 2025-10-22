// export const config = {
//   application: {
//     port: 3000,
//   },
//   databus: {
//     url: "mqtt://localhost",
//     username: "edge",
//     password: "edge",
//     client: "LogotronicAdapter",
//     topic: {
//       read: "ie/d/j/simatic/v1/s7c1/dp/r/plc/default",
//       write: "ie/d/j/simatic/v1/s7c1/dp/w/plc",
//       metadata: "ie/m/j/simatic/v1/s7c1/dp",
//       update: "ie/c/j/simatic/v1/updaterequest",
//       status: "ie/s/j/simatic/v1/s7c1/status",
//     },
//   },
//   logotronicserver: {
//     host: "localhost",
//     port: 64002,
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
    client: "LogotronicAdapter",
    topic: {
      read: "ie/d/j/simatic/v1/opcuac1/dp/r/plc/default",
      write: "ie/d/j/simatic/v1/opcuac1/dp/w/plc",
      metadata: "ie/m/j/simatic/v1/opcuac1/dp",
      update: "ie/c/j/simatic/v1/updaterequest",
      status: "ie/s/j/simatic/v1/opcuac1/status",
    },
  },
  logotronicserver: {
    host: "localhost",
    port: 64002,
  },
};
