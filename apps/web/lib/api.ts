import type {
  AskRequest,
  AskResponse,
  DocumentParagraphsResponse,
  DocumentResponse,
  HealthResponse,
  SearchRequest,
  SearchResponse,
} from "shared";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    throw new ApiError(
      payload?.error?.message ??
        `Request failed with status ${response.status}.`,
      response.status,
      payload?.error?.code,
    );
  }

  return (await response.json()) as T;
}

export function getHealth() {
  return requestJson<HealthResponse>("/health", { method: "GET" });
}

export function searchAuthorities(input: SearchRequest) {
  const params = new URLSearchParams();
  params.set("q", input.query);
  params.set("top_k", String(input.topK));
  if (input.filters.court) {
    params.set("court", input.filters.court);
  }
  if (input.filters.jurisdiction) {
    params.set("jurisdiction", input.filters.jurisdiction);
  }
  if (input.filters.documentType) {
    params.set("document_type", input.filters.documentType);
  }
  if (input.filters.dateFrom) {
    params.set("date_from", input.filters.dateFrom);
  }
  if (input.filters.dateTo) {
    params.set("date_to", input.filters.dateTo);
  }

  return requestJson<SearchResponse>(`/search?${params.toString()}`, {
    method: "GET",
  });
}

export function askLegalQuestion(input: AskRequest) {
  return requestJson<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDocument(documentId: string) {
  return requestJson<DocumentResponse>(`/documents/${documentId}`, {
    method: "GET",
  });
}

export function getDocumentParagraphs(documentId: string) {
  return requestJson<DocumentParagraphsResponse>(
    `/documents/${documentId}/paragraphs`,
    {
      method: "GET",
    },
  );
}
