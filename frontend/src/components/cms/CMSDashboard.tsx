import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardView } from "./DashboardView";
import { POPView } from "./POPView";
import { POSView } from "./POSView";
import { RoznamchaView } from "./RoznamchaView";
import { AssetsView } from "./AssetsView";
import { CustomersView } from "./CustomersView";

export function CMSDashboard() {
  const [activeTab, setActiveTab] = useState("pop");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "pop":
        return <POPView />;
      case "pos":
        return <POSView />;
      case "roznamcha":
        return <RoznamchaView />;
      case "assets":
        return <AssetsView />;
      case "customers":
        return <CustomersView />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <p className="text-muted-foreground">This section is under development</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      {renderContent()}
    </div>
  );
}
