# Plan: Add jobInfo Telegram (TypeID 10075) — Revised

Add a new telegram message `jobInfo` with TypeID 10075 that queries job details from the Logotronic MES server using order/product/job numbers and returns planning speed and plus production values. Implementation follows existing patterns: tag name-based lookups, conditional errorReason publishing, and no upfront input validation.

## Steps

1. **Define TypeID constant** in `src/dataset/typeid.ts` by adding `jobInfo: "10075"` to the `rapidaTypeIds` object.

2. **Create parser module** at `src/parsers/jobInfo.ts` implementing `parseJobInfoResponse()` to extract nested Order/Prod/Job attributes (`no`, `planSpeed`, `plusProduction`) from XML Response structure, returning a `JobInfoResponse` interface extending `ResponseMeta` with flattened fields.

3. **Register parser** in `src/parsers/registry.ts` by importing `parseJobInfoResponse` and `JobInfoResponse`, adding `JobInfoResponse` to `DomainResponse` union type, and mapping `10075: parseJobInfoResponse` in the registry object.

4. **Create telegram service** at `src/services/telegrams/jobInfo.ts` with `logotronicRequestBuilder()` reading tag names `LTA-Data.jobInfo.toServer.*` via `getValueByTagName()`, building XML Request with Job element attributes (orderNo, prodNo, jobNo), wrapping with `createLogotronicRequestFrame()`, and sending via TCP; `logotronicResponseHandler()` parsing response, retrieving tag objects via `getTagDataByTagName()` for names like `LTA-Data.jobInfo.toMachine.*`, mapping domain fields to `{ id: tagObject.id, val: value }` pairs, conditionally including errorReason only when returnCode ≠ 1, publishing via MQTT, and triggering done signal after 1 second.

5. **Register service** in `src/services/dataprocessing.ts` by importing `logotronicRequestBuilder as jobInfoBuilder` and `logotronicResponseHandler as jobInfoHandler` from `./telegrams/jobInfo`, adding `"LTA-Data.jobInfo.command.execute": jobInfoBuilder` to `serviceRequestTriggers` map, and adding `[rapidaTypeIds.jobInfo]: jobInfoHandler` to `serviceResponseHandlers` map.

## Further Considerations

1. **Input validation strategy** – Follow existing pattern from jobList, personnel, and jobHeadDataExchange: proceed with empty strings or default values when tags are missing. Use `|| ""` fallback for orderNo/prodNo/jobNo parameters.

2. **TypeID validation** – Apply strict typeId validation like personnel and jobHeadDataExchange. Validate that response typeId matches `parseInt(rapidaTypeIds.jobInfo, 10)` and abort processing on mismatch.

3. **Error signal handling** – Maintain consistency with existing implementations: do not set `command.error` tag. Only publish errorReason conditionally when returnCode ≠ 1.

## Tag Names Reference

### Input Tags (toServer)

- `LTA-Data.jobInfo.toServer.typeId` (DInt, id: 3502)
- `LTA-Data.jobInfo.toServer.job.orderNo` (String, id: 3503)
- `LTA-Data.jobInfo.toServer.job.prodNo` (String, id: 3504)
- `LTA-Data.jobInfo.toServer.job.jobNo` (String, id: 3505)

### Output Tags (toMachine)

- `LTA-Data.jobInfo.toMachine.typeId` (DInt, id: 3494)
- `LTA-Data.jobInfo.toMachine.returnCode` (DInt, id: 3495)
- `LTA-Data.jobInfo.toMachine.errorReason` (String, id: 3496)
- `LTA-Data.jobInfo.toMachine.order.no` (String, id: 3497)
- `LTA-Data.jobInfo.toMachine.order.prod.no` (String, id: 3498)
- `LTA-Data.jobInfo.toMachine.order.prod.job.no` (String, id: 3499)
- `LTA-Data.jobInfo.toMachine.order.prod.job.planSpeed` (DInt, id: 3500)
- `LTA-Data.jobInfo.toMachine.order.prod.job.plusProduction` (DInt, id: 3501)

### Command Control Tags

- `LTA-Data.jobInfo.command.execute` (Bool, id: 3490)
- `LTA-Data.jobInfo.command.done` (Bool, id: 3491)
- `LTA-Data.jobInfo.command.error` (Bool, id: 3492)
- `LTA-Data.jobInfo.command.busy` (Bool, id: 3493)

## XML Protocol Reference

### Request Example

```xml
<Request typeId="10075">
  <Job orderNo="12345" prodNo="4321" jobNo="4711" />
</Request>
```

### Response Example

```xml
<Response typeId="10075" returnCode="1">
  <Order no="12345">
    <Prod no="4321">
      <Job no="4711" planSpeed="18550" plusProduction="250"/>
    </Prod>
  </Order>
</Response>
```

## Implementation Notes

- Use `getValueByTagName()` for reading input values in request builder
- Use `getTagDataByTagName()` for retrieving tag metadata (including `id` field) in response handler
- Tag IDs may change between deployments; always use tag names for lookups
- Follow existing pattern: read tags with `|| ""` or `|| "0"` fallbacks, no explicit validation
- Conditionally publish errorReason only when `returnCode !== 1`
- Publish done signal 1 second after main response via `setTimeout()`
- XML attributes are accessed via `["@_attributeName"]` pattern in fast-xml-parser
