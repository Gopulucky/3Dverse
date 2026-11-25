import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wordmark } from "@/components/shared/wordmark";

/** Centered card used by the small account-recovery pages (forgot/reset/verify). */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block" aria-label="buy&sell3d home">
            <Wordmark className="text-3xl" />
          </Link>
        </div>
        <Card className="border-border/50">
          <CardHeader className="text-center">
            <CardTitle><h1 className="text-2xl">{title}</h1></CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
