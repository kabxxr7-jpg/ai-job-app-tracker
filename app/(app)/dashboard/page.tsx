import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const total = await prisma.application.count();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total applications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{total}</p>
          <p className="text-sm text-muted-foreground">
            Full funnel stats (response rate, time-to-response) land in M2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
