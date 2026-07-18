"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileBox,
  Save,
  Loader2,
  Image as ImageIcon,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/stores/auth-store";
import ModelViewer from "@/components/ModelViewer";
import { cn } from "@/lib/utils";
import { StudioShell } from "@/components/layout/studio-shell";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const unwrappedParams = use(params);
  const productId = unwrappedParams.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // useRequireAuth handles the login redirect once hydration completes.
    if (!isAuthenticated) return;
    fetchProduct();
  }, [productId, isAuthenticated]);

  const fetchProduct = async () => {
    try {
      const products = await api.get<any[]>("/api/products/creator");
      const p = products.find((x: any) => x.id === parseInt(productId));
      if (!p) throw new Error("Product not found");
      // Ensure print_settings exists
      if (!p.print_settings) {
        p.print_settings = {
          supports_required: false,
          raft_brim_required: false,
          infill_percentage: 15,
          layer_height: 0.2,
          recommended_materials: [],
        };
      }
      setProduct(p);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch product");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent, statusOverride?: string) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        status: statusOverride || product.status,
        print_settings: product.print_settings,
        hardware_required: product.hardware_required,
        assembly_instructions: product.assembly_instructions,
        is_mode_2_active: product.is_mode_2_active,
        is_mode_3_active: product.is_mode_3_active,
        is_mode_4_active: product.is_mode_4_active,
        digital_download_enabled: product.digital_download_enabled,
        watermark_enabled: product.watermark_enabled,
        available_materials: product.available_materials || [],
        available_colors: product.available_colors || [],
        available_sizes: product.available_sizes || [],
        base_print_price: product.base_print_price,
        mode_4_config:
          typeof product.mode_4_config === "string"
            ? JSON.parse(product.mode_4_config)
            : product.mode_4_config || {},
      };

      await api.put(`/api/products/${productId}`, payload);

      toast.success(
        statusOverride === "published"
          ? "Product published successfully!"
          : statusOverride === "draft"
          ? "Product unpublished."
          : "Product saved successfully"
      );
      await fetchProduct();
    } catch (err: any) {
      toast.error(err.detail || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = () => {
    if (product.status === "published") {
      handleUpdate(undefined, "draft");
    } else {
      handleUpdate(undefined, "published");
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "model" | "media"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (type === "media") {
      formData.append("is_primary", "true");
    }

    try {
      await api.upload(`/api/products/${productId}/upload-${type}`, formData);
      toast.success(`${type === "media" ? "Image" : "Model"} uploaded`);
      await fetchProduct();
    } catch (err: any) {
      toast.error(err.detail || `Failed to upload ${type}`);
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <StudioShell>
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[600px]" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </StudioShell>
    );
  }

  if (!product) {
    return (
      <StudioShell>
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <p className="text-muted-foreground text-lg font-display">Product not found</p>
        </div>
      </StudioShell>
    );
  }

  const latestVersion = product.versions?.find((v: any) => v.is_latest);

  return (
    <StudioShell>
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <Link
          href="/creator/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-semibold"
        >
          <ArrowLeft size={16} /> Back to Library
        </Link>

        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center font-display mb-2">
              {product.title}
            </h1>
            <p className="text-muted-foreground text-sm flex gap-3 items-center">
              <span>{latestVersion?.file_name || "No model file"}</span>
              <Badge
                variant={product.status === "published" ? "success" : "secondary"}
                className="text-xs"
              >
                {product.status?.toUpperCase()}
              </Badge>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePublishToggle}
              disabled={saving}
              variant={product.status === "published" ? "secondary" : "default"}
            >
              {saving && <Loader2 size={16} className="animate-spin mr-2" />}
              {product.status === "published" ? "Unpublish" : "Publish Design"}
            </Button>
            <Button onClick={(e) => handleUpdate(e)} disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN: Viewer & Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 3D VIEWER */}
            <Card className="p-1 overflow-hidden bg-card border-border">
              {latestVersion ? (
                <div className="h-[400px] w-full bg-muted/30 rounded-lg overflow-hidden relative">
                  <ModelViewer
                    url={api.mediaUrl(latestVersion.file_url)}
                    extension={latestVersion.file_name?.split('.').pop() || ""}
                  />
                  <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-mono border shadow-sm">
                    Vol: {latestVersion.printability_report?.volume_mm3 ? (latestVersion.printability_report.volume_mm3 / 1000).toFixed(2) + " cm³" : "Calculating..."}
                  </div>
                </div>
              ) : (
                <div className="h-[400px] bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground border border-dashed">
                  <FileBox size={48} className="mb-4 opacity-50" />
                  <p>No 3D model uploaded yet.</p>
                </div>
              )}
            </Card>

            {/* PRODUCT DETAILS */}
            <Card className="p-6 border-border bg-card">
              <h2 className="text-xl font-bold mb-6 font-display">General Details</h2>
              <form className="space-y-4">
                <div>
                  <Label className="mb-2 block">Title</Label>
                  <Input
                    value={product.title}
                    onChange={(e) =>
                      setProduct({ ...product, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Description</Label>
                  <Textarea
                    rows={4}
                    value={product.description || ""}
                    onChange={(e) =>
                      setProduct({ ...product, description: e.target.value })
                    }
                    placeholder="Describe your design, instructions, story, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Category</Label>
                    <Input
                      value={product.category || ""}
                      onChange={(e) =>
                        setProduct({ ...product, category: e.target.value })
                      }
                    />
                  </div>
                </div>
              </form>
            </Card>

            {/* 3D PRINT SETTINGS */}
            <Card className="p-6 border-border bg-card">
              <h2 className="text-xl font-bold mb-2 font-display flex items-center gap-2">
                <Settings2 size={20} className="text-primary" />
                3D Print Settings
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Provide slicer settings to help others successfully print this model.
              </p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex flex-col gap-2 p-3 border rounded-lg bg-card/50 cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-sm font-semibold">Requires Supports?</span>
                    <input
                      type="checkbox"
                      checked={product.print_settings?.supports_required || false}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            supports_required: e.target.checked,
                          },
                        })
                      }
                      className="accent-primary"
                    />
                  </label>
                  
                  <label className="flex flex-col gap-2 p-3 border rounded-lg bg-card/50 cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-sm font-semibold">Raft / Brim?</span>
                    <input
                      type="checkbox"
                      checked={product.print_settings?.raft_brim_required || false}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            raft_brim_required: e.target.checked,
                          },
                        })
                      }
                      className="accent-primary"
                    />
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs">Infill (%)</Label>
                    <Input
                      type="number"
                      value={product.print_settings?.infill_percentage || ""}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            infill_percentage: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="e.g. 15"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Layer Height (mm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={product.print_settings?.layer_height || ""}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            layer_height: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="e.g. 0.2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Recommended Materials</Label>
                    <Input
                      value={(product.print_settings?.recommended_materials || []).join(", ")}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            recommended_materials: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      placeholder="e.g. PLA, PETG, TPU"
                    />
                  </div>

                  <div className="space-y-3 pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.hardware_required}
                        onChange={(e) =>
                          setProduct({
                            ...product,
                            hardware_required: e.target.checked,
                          })
                        }
                        className="accent-primary w-4 h-4"
                      />
                      <span className="text-sm font-semibold">Requires extra hardware (screws, bearings, etc.)</span>
                    </label>
                  </div>
                </div>

                {product.hardware_required && (
                  <div>
                    <Label className="mb-2 block">Assembly Instructions / Hardware List</Label>
                    <Textarea
                      rows={3}
                      value={product.assembly_instructions || ""}
                      onChange={(e) =>
                        setProduct({ ...product, assembly_instructions: e.target.value })
                      }
                      placeholder="List M3 screws, magnets, glue required, or link to a guide..."
                    />
                  </div>
                )}
              </div>
            </Card>

          </div>

          {/* RIGHT COLUMN: Files, Media, Sales Modes */}
          <div className="space-y-6">
            
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">Product Images</h2>
              <div className="space-y-4">
                {product.media
                  ?.filter((m: any) => m.media_type === "image")
                  .map((m: any) => (
                    <div
                      key={m.id}
                      className="relative rounded-xl overflow-hidden border border-border bg-muted"
                    >
                      <img
                        src={api.mediaUrl(m.media_url)}
                        alt="Product preview"
                        className="w-full h-auto object-cover"
                      />
                      {m.is_primary && (
                        <Badge
                          variant="default"
                          className="absolute top-2 right-2"
                        >
                          Primary
                        </Badge>
                      )}
                    </div>
                  ))}

                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer transition-colors">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="text-sm font-medium">Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "media")}
                    disabled={uploading}
                  />
                </label>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">3D Model Versions</h2>

              <div className="border-2 border-dashed border-border rounded-xl p-4 text-center mb-4 hover:border-primary/50 transition-colors">
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium w-full h-10 px-4 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? "Uploading..." : "Upload New Version"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".stl,.obj,.3mf,.step,.fbx,.blend"
                    onChange={(e) => handleFileUpload(e, "model")}
                    disabled={uploading}
                  />
                </label>
              </div>

              {product.versions && product.versions.length > 0 && (
                <div className="space-y-3">
                  {product.versions
                    .sort((a: any, b: any) => b.version_number - a.version_number)
                    .map((v: any) => {
                      const report = v.printability_report;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "flex flex-col p-3 rounded-lg border text-sm",
                            v.is_latest
                              ? "bg-primary/5 border-primary/30"
                              : "bg-card border-border"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex gap-2 items-center">
                              V{v.version_number}
                              {v.is_latest && (
                                <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                                  LATEST
                                </Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono truncate mb-2">
                            {v.file_name} ({(v.file_size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                          
                          {report && (
                            <div className="flex items-center justify-between border-t pt-2 mt-1">
                              <span className="text-[10px] font-medium text-muted-foreground">Checks:</span>
                              <Badge
                                variant={
                                  report.status === "pass" ? "success"
                                    : report.status === "warning" ? "warning"
                                    : report.status === "fail" ? "destructive"
                                    : "outline"
                                }
                                className="text-[9px]"
                              >
                                {report.status}
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">Sales & Modes</h2>
              <div className="space-y-4">
                {/* Mode 2 */}
                <div className="border border-border rounded-xl p-4 bg-card/50">
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={product.is_mode_2_active}
                      onChange={(e) =>
                        setProduct({ ...product, is_mode_2_active: e.target.checked })
                      }
                      className="accent-primary w-4 h-4"
                    />
                    <span className="font-semibold text-sm">Mode 2: Digital Asset</span>
                  </label>
                  {product.is_mode_2_active && (
                    <div className="pl-7 space-y-2">
                      <Label className="text-xs">Download Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={product.price}
                        onChange={(e) =>
                          setProduct({ ...product, price: parseFloat(e.target.value) })
                        }
                        className="h-8"
                      />
                    </div>
                  )}
                </div>

                {/* Mode 3 */}
                <div className="border border-border rounded-xl p-4 bg-card/50">
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={product.is_mode_3_active}
                      onChange={(e) =>
                        setProduct({ ...product, is_mode_3_active: e.target.checked })
                      }
                      className="accent-primary w-4 h-4"
                    />
                    <span className="font-semibold text-sm">Mode 3: Physical Prints</span>
                  </label>
                  {product.is_mode_3_active && (
                    <div className="pl-7 space-y-2">
                      <Label className="text-xs">Base Print Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={product.base_print_price}
                        onChange={(e) =>
                          setProduct({ ...product, base_print_price: parseFloat(e.target.value) })
                        }
                        className="h-8"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </StudioShell>
  );
}
