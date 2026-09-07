import { useParams } from "react-router-dom";
import FlowEditor from "@/components/automations/FlowEditor";

export default function AutomationFlow() {
  const { automationId } = useParams<{ automationId: string }>();
  return <FlowEditor key={automationId} />;
}
