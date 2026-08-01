"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StudioShell } from "@/components/layout/studio-shell";
import { useRequireAuth } from "@/stores/auth-store";

export default function DraftProductPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    objectType: "",
    intendedUse: "",
    material: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please provide a title");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the draft product with the provided description and mock settings
      const descriptionWithContext = `
${formData.description}

---
**Project Brief Context**
- **Object Type**: ${formData.objectType || "Not specified"}
- **Intended Use**: ${formData.intendedUse || "Not specified"}
      `.trim();

      const product = await api.post<any>("/api/products/", {
        title: formData.title.trim(),
        description: descriptionWithContext,
        category: formData.objectType || "Other",
        price: 0,
        license_type: "standard",
        status: "draft",
        tags: [],
        print_settings: {
          recommended_materials: formData.material ? [formData.material] : [],
        }
      });

      toast.success("Project brief created successfully!");
      router.push(`/creator/products/${product.id}`);
    } catch (err: any) {
      toast.error(err.detail || "Failed to create draft");
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <StudioShell>
        <div className="max-w-3xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-20">
        <Link
          href="/creator/products/new"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-semibold"
        >
          <ArrowLeft size={16} />
          Back to Upload
        </Link>

        <Card className="p-8 border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ember/10 flex items-center justify-center text-ember">
              <Sparkles size={20} />
            </div>
            <h1 className="text-2xl font-bold font-display">
              Create Project Brief
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mb-8">
            Describe your idea to create a structured project draft. You can refine details, adjust settings, and upload your 3D model later.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Give your design a name..."
                className="h-12 text-lg"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">What is the object?</Label>
              <Input
                value={formData.objectType}
                onChange={(e) => setFormData({ ...formData, objectType: e.target.value })}
                placeholder="e.g. Headphone stand, mechanical keyboard case, vase..."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Description & Notes</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your design in plain English..."
                rows={4}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Intended Use</Label>
                <Input
                  value={formData.intendedUse}
                  onChange={(e) => setFormData({ ...formData, intendedUse: e.target.value })}
                  placeholder="e.g. Desk accessory, outdoor tool..."
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Preferred Material</Label>
                <Input
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  placeholder="e.g. PLA, PETG, TPU..."
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border flex justify-end">
              <Button 
                type="submit" 
                disabled={!formData.title || isSubmitting} 
                size="lg"
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <CheckCircle2 size={18} className="mr-2" />
                )}
                {isSubmitting ? "Generating Brief..." : "Create Project Draft"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </StudioShell>
  );
}
