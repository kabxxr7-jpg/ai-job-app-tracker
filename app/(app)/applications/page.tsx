import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Button render={<Link href="/applications/new" />} nativeButton={false}>
          New application
        </Button>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No applications yet.{" "}
            <Link href="/applications/new" className="underline">
              Add your first one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fit score</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/applications/${app.id}`} className="block font-medium hover:underline">
                        {app.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/applications/${app.id}`} className="block">
                        {app.roleTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell>{app.fitScore != null ? `${app.fitScore}/100` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.updatedAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
