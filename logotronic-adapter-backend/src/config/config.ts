export const config = {
  application: {
    port: 3000,
  },
  databus: {
    url: "mqtt://192.168.0.149",
    username: "edge",
    password: "edge",
    client: "LogotronicAdapter",
    topic: {
      read: "ie/d/j/simatic/v1/s7c1/dp/r/plc/default",
      write: "ie/d/j/simatic/v1/s7c1/dp/w/plc",
      metadata: "ie/m/j/simatic/v1/s7c1/dp",
      update: "ie/c/j/simatic/v1/updaterequest",
      status: "ie/s/j/simatic/v1/s7c1/status",
    },
  },
  // logotronicserver: {
  //   host: "192.168.0.166",
  //   port: 64001,
  // },
  machinetype: "machine2000",
  github: {
    token: "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",
    repo: {
      owner: "maxigado",
      name: "logotronic-adapter-error-texts",
    },
  },
};

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
//     port: 64001,
//   },
// };
