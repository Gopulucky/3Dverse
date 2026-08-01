"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Image as ImageIcon,
  Camera,
  Globe,
  AtSign,
  Link2,
  Video,
  Loader2,
  Plus,
  Star,
  Eye,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRequireAuth } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";

const SPECIALIZATION_OPTIONS = [
  "Miniatures", "Tabletop", "Cosplay", "Jewelry", "Home Decor",
  "Gadgets", "Prototyping", "Articulated", "Terrain", "Props",
];

export default function CreatorPortfolioPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const portfolioInput = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["creator-profile"],
    queryFn: () => api.get<any>("/api/creator/profile"),
    enabled: isAuthenticated,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["creator-products"],
    queryFn: () => api.get<any[]>("/api/products/creator"),
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    bio: "",
    website_url: "",
    instagram: "",
    twitter: "",
    youtube: "",
  });
  const [specializations, setSpecializations] = useState<string[]>([]);


  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        company_name: profile.company_name || "",
        bio: profile.bio || "",
        website_url: profile.website_url || "",
        instagram: profile.social_links?.instagram || "",
        twitter: profile.social_links?.twitter || "",
        youtube: profile.social_links?.youtube || "",
      });
      setSpecializations(profile.specializations || []);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put("/api/creator/profile", {
        full_name: form.full_name || null,
        company_name: form.company_name || null,
        bio: form.bio || null,
        website_url: form.website_url || null,
        social_links: {
          instagram: form.instagram || null,
          twitter: form.twitter || null,
          youtube: form.youtube || null,
        },
        specializations,
      }),
    onSuccess: () => {
      toast.success("Portfolio saved");
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
    },
    onError: () => toast.error("Failed to save portfolio"),
  });

  const uploadFile = async (
    endpoint: string,
    file: File,
    successMsg: string
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.upload(endpoint, fd);
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
    } catch {
      toast.error("Upload failed");
    }
  };

  const toggleSpec = (s: string) =>
    setSpecializations((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  if (!isAuthenticated) return null;

  const published = products.filter((p: any) => p.status === "published");
  const displayName =
    form.company_name || form.full_name || profile?.email?.split("@")[0];

  return (
    <StudioShell>
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
              <ImageIcon className="text-ember" />
              Portfolio
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              This is your public storefront — what customers see when they
              click your name.
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
            {/* Left column — identity editor */}
            <div className="space-y-6">
              {/* Identity card */}
              <Card className="p-6 border-border bg-card">
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={() => avatarInput.current?.click()}
                    className="relative group shrink-0"
                    aria-label="Change avatar"
                  >
                    <Avatar className="h-20 w-20 border-2 border-border">
                      {profile?.avatar_url && (
                        <AvatarImage src={api.mediaUrl(profile.avatar_url)} />
                      )}
                      <AvatarFallback className="bg-primary-surface text-primary-ink text-2xl font-bold">
                        {displayName?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 rounded-full bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={20} className="text-primary-foreground" />
                    </span>
                  </button>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        uploadFile(
                          "/api/creator/profile/avatar",
                          f,
                          "Avatar updated"
                        );
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-lg font-display truncate flex items-center gap-1.5">
                      {displayName}
                      <BadgeCheck size={16} className="text-moss shrink-0" />
                    </p>
                    {profile?.creator_tier && (
                      <Badge variant="secondary" className="capitalize mt-1">
                        {profile.creator_tier} tier
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Display / Studio Name</Label>
                    <Input
                      value={form.company_name}
                      placeholder="e.g. Voxel Forge Studio"
                      onChange={(e) =>
                        setForm({ ...form, company_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Full Name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) =>
                        setForm({ ...form, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Bio</Label>
                    <Textarea
                      rows={4}
                      value={form.bio}
                      placeholder="Tell customers what you design and why they'll love it..."
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              {/* Links card */}
              <Card className="p-6 border-border bg-card space-y-4">
                <h3 className="font-bold font-display">Links</h3>
                {[
                  { key: "website_url", icon: Globe, ph: "https://yourstudio.com" },
                  { key: "instagram", icon: AtSign, ph: "instagram.com/you" },
                  { key: "twitter", icon: Link2, ph: "x.com/you" },
                  { key: "youtube", icon: Video, ph: "youtube.com/@you" },
                ].map((l) => (
                  <div key={l.key} className="flex items-center gap-3">
                    <l.icon size={16} className="text-muted-foreground shrink-0" />
                    <Input
                      value={(form as any)[l.key]}
                      placeholder={l.ph}
                      onChange={(e) =>
                        setForm({ ...form, [l.key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </Card>

              {/* Specializations */}
              <Card className="p-6 border-border bg-card">
                <h3 className="font-bold font-display mb-3">Specializations</h3>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATION_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSpec(s)}
                      className={
                        specializations.includes(s)
                          ? "px-3 py-1 rounded-full text-xs font-semibold bg-ember-surface text-ember-ink border border-ember"
                          : "px-3 py-1 rounded-full text-xs font-semibold bg-card text-muted-foreground border border-border hover:border-ember/40"
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right column — gallery + storefront preview */}
            <div className="space-y-6">
              {/* Portfolio gallery */}
              <Card className="p-6 border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold font-display">Work Gallery</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => portfolioInput.current?.click()}
                  >
                    <Plus size={14} /> Add Photo
                  </Button>
                  <input
                    ref={portfolioInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        uploadFile(
                          "/api/creator/profile/portfolio",
                          f,
                          "Photo added to gallery"
                        );
                    }}
                  />
                </div>
                {profile?.portfolio_images?.length ? (
                  <div className="grid grid-cols-3 gap-3">
                    {profile.portfolio_images.map((url: string, i: number) => (
                      <img
                        key={i}
                        src={api.mediaUrl(url)}
                        alt={`Portfolio ${i + 1}`}
                        className="aspect-square object-cover rounded-lg border border-border"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 border border-dashed border-border rounded-lg">
                    <Camera className="mx-auto mb-2 text-muted-foreground" size={28} />
                    <p className="text-sm text-muted-foreground">
                      Add photos of your printed work — customers trust real
                      prints.
                    </p>
                  </div>
                )}
              </Card>

              {/* Storefront preview */}
              <Card className="p-6 border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold font-display flex items-center gap-2">
                    <Eye size={16} className="text-ember" />
                    Your Storefront
                  </h3>
                  <span className="text-xs text-muted-foreground font-data">
                    {published.length} live design{published.length === 1 ? "" : "s"}
                  </span>
                </div>
                {published.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {published.map((p: any) => {
                      const img =
                        p.media?.find((m: any) => m.is_primary)?.media_url ||
                        p.media?.[0]?.media_url;
                      return (
                        <Link
                          key={p.id}
                          href={`/marketplace/${p.id}`}
                          className="group rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-all"
                        >
                          <div className="aspect-square bg-muted overflow-hidden">
                            {img ? (
                              <img
                                src={api.mediaUrl(img)}
                                alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-semibold truncate">
                              {p.title}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-data text-muted-foreground">
                                ${p.price?.toFixed(2)}
                              </span>
                              {p.avg_rating != null && (
                                <span className="flex items-center gap-0.5 text-xs text-ember font-data">
                                  <Star size={10} fill="currentColor" />
                                  {p.avg_rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground mb-2">
                      No published designs yet.
                    </p>
                    <Link
                      href="/creator/products/new"
                      className="text-ember text-sm font-semibold hover:underline"
                    >
                      Upload your first design →
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </StudioShell>
  );
}
