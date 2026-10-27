import { createApplicationFromForm } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewApplicationPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createApplicationFromForm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company</Label>
              <Input id="companyName" name="companyName" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleTitle">Role title</Label>
              <Input id="roleTitle" name="roleTitle" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobPostingUrl">Job posting URL (optional)</Label>
              <Input id="jobPostingUrl" name="jobPostingUrl" type="url" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobPostingText">Job description (optional, paste text)</Label>
              <Textarea
                id="jobPostingText"
                name="jobPostingText"
                rows={8}
                placeholder="Paste the job description here — you can run AI analysis on it later from the application page."
              />
            </div>
            <Button type="submit">Create application</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
