import { Sparkles, Check, TrendingUp, Tag, ArrowDownCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Insight {
  id: string;
  type: "positive" | "action" | "warning";
  text: string;
  icon?: LucideIcon;
}

const mockInsights: Insight[] = [
  {
    id: "1",
    type: "positive",
    text: "This model is trending in 'Industrial'",
    icon: TrendingUp,
  },
  {
    id: "2",
    type: "action",
    text: "Add more screenshots for higher conversion",
    icon: Check,
  },
  {
    id: "3",
    type: "warning",
    text: "Reduce price by 10% to match category average",
    icon: ArrowDownCircle,
  },
  {
    id: "4",
    type: "action",
    text: "Add 'Robot' and 'Assembly' tags",
    icon: Tag,
  }
];

export function AIInsightsPanel({ insights = mockInsights }: { insights?: Insight[] }) {
  return (
    <Card className="p-5 border-border bg-card hover-lift transition-all flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <Sparkles size={16} className="animate-pulse" />
        </div>
        <h3 className="font-bold font-display">AI Insights</h3>
      </div>
      
      <div className="space-y-4 flex-1">
        {insights.map((insight) => {
          const Icon = insight.icon || Check;
          
          let iconColor = "text-primary";
          
          if (insight.type === "positive") {
            iconColor = "text-success";
          } else if (insight.type === "warning") {
            iconColor = "text-warning";
          }
          
          return (
            <div key={insight.id} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className={`mt-0.5 ${iconColor}`}>
                <Icon size={16} />
              </div>
              <p className="text-sm font-medium text-foreground leading-snug flex-1">
                {insight.text}
              </p>
            </div>
          );
        })}
      </div>
      
      <Button variant="ghost" className="w-full mt-4 justify-between text-primary hover:text-primary hover:bg-primary/10 group">
        View All Suggestions
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </Button>
    </Card>
  );
}
