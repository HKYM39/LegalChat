import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_PORT_CANDIDATES = [8787, 8788, 8789, 8790, 8791, 8792, 8793, 8794, 8795];
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const FILTERED_REQUEST_HEADERS = new Set(["host", "accept-encoding"]);
const FILTERED_RESPONSE_HEADERS = new Set(["content-encoding", "content-length"]);

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function getConfiguredBaseUrls(): string[] {
  const configured = [
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeBaseUrl(value.trim()));

  return [...new Set(configured)];
}

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return response.status >= 200 && response.status < 600;
  } catch {
    return false;
  }
}

async function resolveBackendBaseUrl(): Promise<string> {
  const configured = getConfiguredBaseUrls();
  for (const baseUrl of configured) {
    if (await isReachable(baseUrl)) {
      return baseUrl;
    }
  }

  for (const port of DEFAULT_PORT_CANDIDATES) {
    const candidate = `http://127.0.0.1:${port}`;
    if (await isReachable(candidate)) {
      return candidate;
    }
  }

  return configured[0] ?? "http://127.0.0.1:8788";
}

function buildTargetUrl(baseUrl: string, path: string[], search: string): string {
  return `${baseUrl}/${path.join("/")}${search}`;
}

function createForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && !FILTERED_REQUEST_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  return headers;
}

function createResponseHeaders(source: Headers): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && !FILTERED_RESPONSE_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  return headers;
}

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const baseUrl = await resolveBackendBaseUrl();
  const targetUrl = buildTargetUrl(baseUrl, path, request.nextUrl.search);
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: createForwardHeaders(request),
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "api_unavailable",
          message: "后端 API 当前不可用。",
        },
      },
      { status: 503 },
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: createResponseHeaders(upstream.headers),
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
