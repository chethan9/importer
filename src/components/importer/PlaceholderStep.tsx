import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";

export function PlaceholderStep({ title, description }: { title: string; description: string }) {
  const { setStep } = useFirebase();
  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in-up px-6 pb-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Construction className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep(2)}>
            Back to collections
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}