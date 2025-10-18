import { ParsedResponseRoot, ResponseMeta } from "../utility/xml";

export interface PersonnelEntry {
  firstName?: string;
  lastName?: string;
  internalId?: number | string;
  id?: number | string;
  job?: number;
  loginAs?: number;
  loginTime?: number;
  loginWorkplaceId?: number;
  pause?: number;
  jpegDataBase64?: string;
  password?: string;
}

export interface PersonnelResponse extends ResponseMeta {
  people: PersonnelEntry[];
}

function normalizeArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export function parsePersonnelResponse(
  root: ParsedResponseRoot,
  meta: ResponseMeta
): PersonnelResponse {
  const resp = root.Response || {};
  const personalsRaw = normalizeArray<any>(resp.Personal);
  const people: PersonnelEntry[] = personalsRaw.map((p: any) => {
    let jpegDataBase64: string | undefined;
    const jpegNode = p.JPEGData;
    if (jpegNode) {
      if (typeof jpegNode === "string") jpegDataBase64 = jpegNode.trim();
      else if (jpegNode["#text"])
        jpegDataBase64 = String(jpegNode["#text"]).trim();
    }
    return {
      firstName: p["@_firstName"],
      lastName: p["@_lastName"],
      internalId: p["@_internalId"] ?? p["@_internalld"],
      id: p["@_id"],
      job: p["@_job"],
      loginAs: p["@_loginAs"],
      loginTime: p["@_loginTime"],
      loginWorkplaceId: p["@_loginWorkplaceld"],
      pause: p["@_pause"],
      jpegDataBase64,
      password: p["@_password"],
    };
  });
  return { ...meta, people };
}
