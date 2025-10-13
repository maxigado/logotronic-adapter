/**
 * This module exports a constant object that maps service names to their
 * corresponding Logotronic TypeIDs. This provides a centralized and easily
 * accessible way to retrieve TypeIDs for constructing requests.
 *
 * Example: `rapidaTypeIds.disconnect` will return "10010".
 */
export const rapidaTypeIds = {
  // Standard Logotronic TypeIDs from protocol documentation
  disconnect: "10010",
  operationalData: "10011",
  userEvent: "10012",
  assistantTask: "10015",
  assistantTaskQuery: "10030",
  personnel: "10036",
  userEventsQuery: "10037",
  createChangePersonnel: "10038",
  readRepetitionData: "10049",
  saveRepetitionData: "10050",
  jobList: "10060",
  jobPlan: "10061",
  createJob: "10063",
  getOrderNote: "10006",
  setOrderNote: "10007",
  preview: "10093",
  bdePersonnel: "10008",
  deleteJob: "10165",
  machineShifts: "10111",
  machinePlanList: "10068",
  orderHeadDataExchange: "11010",
  prodHeadDataExchange: "11020",
  jobHeadDataExchange: "11030",

  // Custom/mock TypeIDs
  accept: "99901",
  workplaceSetup: "99902",
  workplaceInfo: "99903",
  versionInfo: "99904",
  timeRequest: "99905",
  info: "99906",
  error: "99907",
  errorText: "99908",
};
