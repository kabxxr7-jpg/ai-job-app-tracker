import { getOrCreateProfile } from "@/lib/profile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateProfile } from "./actions";

export default async function SettingsPage() {
  const profile = await getOrCreateProfile();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resume &amp; skills</CardTitle>
              <CardDescription>
                Used to ground the AI fit-score and outreach-draft generation on the application detail
                page. Nothing here is sent anywhere except to Claude when you run an analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resumeText">Resume text</Label>
                  <Textarea
                    id="resumeText"
                    name="resumeText"
                    rows={10}
                    defaultValue={profile.resumeText}
                    placeholder="Paste a plain-text summary of your resume..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input
                    id="skills"
                    name="skills"
                    defaultValue={profile.skills.join(", ")}
                    placeholder="TypeScript, React, PostgreSQL, ..."
                  />
                </div>
                <Button type="submit">Save profile</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhooks</CardTitle>
              <CardDescription>Outgoing status-change webhooks land in M4.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
