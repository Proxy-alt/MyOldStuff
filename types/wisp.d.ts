// ---- External module types you import ----
declare module '@mercuryworkshop/wisp-js';
export interface Options {
  parse_real_ip: boolean;
  parse_real_ip_from: string[];
  wisp_version: number;
}

export interface AccessDeniedError extends Error {}
export interface HandshakeError extends Error {}

export interface ServerConnection {
  new (ws: WebSocket, path: string, options: Record<string, any>): ServerConnection;
  setup(): Promise<void>;
  run(): Promise<void>;
}

export interface WSProxyConnection {
  new (ws: WebSocket, path: string, options: Record<string, any>): WSProxyConnection;
  setup(): Promise<void>;
}

export interface CompatModule {
  WebSocket: typeof WebSocket;
  WebSocketServer: new (opts: { noServer: boolean }) => {
    handleUpgrade(req: IncomingMessage, socket: NodeJS.Socket, head: Buffer, cb: (ws: WebSocket) => void): void;
  };
  http: {
    IncomingMessage: typeof import('http').IncomingMessage;
  };
}

// ---- Local types for this file ----

export interface HeadersMap {
  [key: string]: string | undefined;
}

export interface ConnectionOptions {
  wisp_version?: number;
  [key: string]: any;
}

export interface RouteRequest {
  headers: HeadersMap;
  url?: string;
  socket: {
    address(): { address: string };
  };
}

export type NodeRequest = import('http').IncomingMessage;
export type NodeSocket = NodeJS.Socket;

// ---- Function types ----

export function parse_real_ip(headers: HeadersMap, client_ip: string): string;

export function routeRequest(request: RouteRequest | WebSocket, socket: NodeSocket, head: Buffer, conn_options?: ConnectionOptions): void;

// Internal helper (not exported)
declare function create_connection(ws: WebSocket, path: string, request: RouteRequest, conn_options: ConnectionOptions): Promise<void>;
