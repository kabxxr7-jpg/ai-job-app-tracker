import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ApplicationNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Application not found</h1>
      <p className="text-muted-foreground">
        This application may have been deleted, or the link is incorrect.
      </p>
      <Button render={<Link href="/applications" />} nativeButton={false}>
        Back to applications
      </Button>
    </div>
  );
}
