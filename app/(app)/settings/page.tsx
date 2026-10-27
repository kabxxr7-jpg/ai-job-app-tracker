import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile &amp; Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Resume/skills profile (M3) and webhook configuration (M4) land here.
        </CardContent>
      </Card>
    </div>
  );
}
