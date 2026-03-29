import { useAIOS } from "@/contexts/AIOSContext";
import { AIOSCommandBar } from "@/components/aios/AIOSCommandBar";
import { DataCanvas } from "@/components/aios/DataCanvas";

export default function AIOSDashboard() {
  const { isLoading, statusText, dataPanels, send, removePanel, resetConversation } = useAIOS();

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <AIOSCommandBar
        onSend={send}
        isLoading={isLoading}
        statusText={statusText}
        onReset={resetConversation}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DataCanvas panels={dataPanels} onRemovePanel={removePanel} />
      </div>
    </div>
  );
}
