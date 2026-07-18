"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud, Loader2, FileBox } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioShell } from "@/components/layout/studio-shell";

export default function NewProductPage() {
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validExtensions = ['.stl', '.obj', '.3mf', '.step', '.fbx', '.blend'];
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      toast.error(`Invalid file type. Supported types: ${validExtensions.join(', ')}`);
      return;
    }
    
    setFile(f);
    // Auto-fill title from filename if not set
    if (!title) {
      setTitle(f.name.replace(ext, '').replace(/[_-]/g, ' '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a 3D model file to upload");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Create the draft product
      const product = await api.post<any>("/api/products/", {
        title: title.trim(),
        description: "",
        category: "Other", // Default, can be changed in edit
        price: 0,
        license_type: "standard",
        status: "draft",
        tags: [],
      });

      // 2. Upload the file
      const formData = new FormData();
      formData.append("file", file);
      
      toast.loading("Uploading 3D model...", { id: "upload-toast" });
      await api.upload(`/api/products/${product.id}/upload-model`, formData);
      toast.success("Upload complete!", { id: "upload-toast" });

      // 3. Redirect to edit page
      router.push(`/creator/products/${product.id}`);
    } catch (err: any) {
      toast.error(err.detail || "Failed to upload product", { id: "upload-toast" });
      setIsUploading(false);
    }
  };

  return (
    <StudioShell>
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-20">
        <Link
          href="/creator/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-semibold"
        >
          <ArrowLeft size={16} />
          Back to Library
        </Link>

        <Card className="p-8 border-border bg-card">
          <h1 className="text-2xl font-bold mb-2 font-display">
            Upload 3D Design
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Start by uploading your primary 3D model file. You can add images, configure print settings, and set pricing on the next screen.
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Drag & Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                dragActive
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : file
                  ? "border-success/50 bg-success/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".stl,.obj,.3mf,.step,.fbx,.blend"
                onChange={handleChange}
                disabled={isUploading}
              />
              
              {file ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-2 text-success">
                    <FileBox size={24} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <p className="text-xs text-primary font-medium mt-4">Click or drag to replace</p>
                </div>
              ) : (
                <div className="space-y-3 pointer-events-none">
                  <UploadCloud size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-semibold">Click or drag file to this area to upload</p>
                  <p className="text-sm text-muted-foreground">
                    Support for a single STL, OBJ, 3MF, STEP, FBX, or BLEND file.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Title */}
            {file && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Label className="mb-2 block">Design Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your design a name..."
                  className="h-12 text-lg"
                  disabled={isUploading}
                  required
                />
              </div>
            )}

            <div className="pt-6 border-t border-border flex justify-end">
              <Button 
                type="submit" 
                disabled={!file || !title || isUploading} 
                size="lg"
                className="w-full sm:w-auto"
              >
                {isUploading ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <UploadCloud size={18} className="mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload & Continue"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </StudioShell>
  );
}
