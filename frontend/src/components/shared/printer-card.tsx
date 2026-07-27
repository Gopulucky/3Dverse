import { Printer, Settings, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface PrinterData {
  id: string;
  name: string;
  status: "running" | "idle" | "maintenance";
  utilization: number;
  technology: string;
}

export function PrinterCard({ printer }: { printer: PrinterData }) {
  const isRunning = printer.status === "running";
  const isIdle = printer.status === "idle";
  const isMaintenance = printer.status === "maintenance";

  let statusColor = "text-success";
  let statusBg = "bg-success/20";
  let Icon = CheckCircle2;
  
  if (isIdle) {
    statusColor = "text-muted-foreground";
    statusBg = "bg-muted";
    Icon = Printer;
  } else if (isMaintenance) {
    statusColor = "text-warning";
    statusBg = "bg-warning/20";
    Icon = AlertTriangle;
  }

  return (
    <Card className="p-5 border-border bg-card hover-lift transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold font-display text-lg">{printer.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{printer.technology}</p>
        </div>
        <div className={`p-2 rounded-lg ${statusBg} ${statusColor}`}>
          <Icon size={16} />
        </div>
      </div>
      
      <div className="mt-6">
        <div className="flex justify-between items-end mb-2">
          <span className={`text-sm font-bold ${statusColor} capitalize flex items-center gap-1.5`}>
            {isRunning && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
            {printer.status}
          </span>
          <span className="text-2xl font-bold font-data text-foreground">{printer.utilization}%</span>
        </div>
        
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              isMaintenance ? "bg-warning" : "bg-primary"
            }`}
            style={{ width: `${printer.utilization}%` }} 
          />
        </div>
        <p className="text-xs text-muted-foreground text-right mt-2 font-medium uppercase tracking-wider">Utilization</p>
      </div>
    </Card>
  );
}
