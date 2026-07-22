import { rcp } from '@kit.RemoteCommunicationKit';

const sessionConfig: rcp.SessionConfiguration = {
  baseAddress: "http://172.29.4.151:8080/api/",
  headers: {
    "Content-Type": "application/json"
  },
}

export const session: rcp.Session = rcp.createSession(sessionConfig);

export interface GenericResponse<T> {
  code: string,
  msg: string | null,
  result: T,
}
