/**
 * 案例详情页服务端入口 (Next.js App Router)
 * 
 * 接收 URL 参数 `documentId`，并将其传递给客户端组件 `DocumentDetailPage`。
 * 该页面用于支撑用户点击 Authority Card 后的“核验原文”功能。
 */
import { DocumentDetailPage } from "@/components/documents/document-detail-page";

type DocumentPageProps = {
  // 动态路由参数 Promise
  params: Promise<{
    documentId: string;
  }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  return <DocumentDetailPage documentId={documentId} />;
}
