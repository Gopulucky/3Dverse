import { Card } from "@/components/ui/card";
import { Filter } from "lucide-react";

export function FunnelChart() {
  const steps = [
    { label: "Visitors", value: "12,300", width: "100%", color: "bg-primary" },
    { label: "Previewed", value: "8,420", width: "80%", color: "bg-primary/80" },
    { label: "Added to Cart", value: "1,240", width: "45%", color: "bg-primary/60" },
    { label: "Purchased", value: "312", width: "20%", color: "bg-primary/40" },
  ];

  return (
    <Card className="p-5 border-border bg-card hover-lift transition-all h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-success/10 rounded-lg text-success">
          <Filter size={16} />
        </div>
        <div>
          <h3 className="font-bold font-display">Conversion Funnel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Where users drop off</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex flex-col items-center group animate-in fade-in slide-in-from-top-2" style={{ animationDelay: `${idx * 150}ms` }}>
            <div className="w-full flex justify-between items-end mb-1 px-4">
              <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{step.label}</span>
              <span className="text-sm font-data font-bold text-foreground">{step.value}</span>
            </div>
            <div className="w-full h-8 bg-muted rounded-full overflow-hidden flex justify-center">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${step.color}`} 
                style={{ width: step.width }} 
              />
            </div>
            {idx < steps.length - 1 && (
              <div className="h-4 w-px bg-border my-1" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
