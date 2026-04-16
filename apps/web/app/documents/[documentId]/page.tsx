import { DocumentDetailPage } from "@/components/documents/document-detail-page";

type DocumentPageProps = {
  params: Promise<{
    documentId: string;
  }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  return <DocumentDetailPage documentId={documentId} />;
}
