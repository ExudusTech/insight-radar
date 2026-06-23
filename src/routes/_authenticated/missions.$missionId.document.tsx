import { createFileRoute } from "@tanstack/react-router";
import { DocumentBaseTab } from "@/components/documents/document-base-tab";

export const Route = createFileRoute("/_authenticated/missions/$missionId/document")({
  component: DocumentRoute,
});

function DocumentRoute() {
  const { missionId } = Route.useParams();
  return <DocumentBaseTab missionId={missionId} />;
}