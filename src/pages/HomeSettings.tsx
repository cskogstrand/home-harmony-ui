import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Users, Shield, Zap, Radio, MapPin, Trash2,
  ChevronRight, Plus, Crown, UserMinus, Key,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useState } from "react";
import { toast } from "sonner";

export default function HomeSettingsPage() {
  const { currentHome, currentUser } = useApp();
  const [showDeleteHome, setShowDeleteHome] = useState(false);
  if (!currentHome) return null;

  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">Home Settings</h1>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="alarm" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Alarm</TabsTrigger>
          <TabsTrigger value="gateway" className="gap-1.5"><Radio className="h-3.5 w-3.5" /> Gateway</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Home details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-2xs text-muted-foreground font-medium">Name</label>
                <Input defaultValue={currentHome.name} className="mt-1" disabled={!isMaster} />
              </div>
              <div>
                <label className="text-2xs text-muted-foreground font-medium">Address</label>
                <div className="flex items-center gap-2 mt-1 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {currentHome.address?.street}, {currentHome.address?.city}
                </div>
              </div>
              {isMaster && (
                <Button size="sm" onClick={() => toast.success("Settings saved")}>Save changes</Button>
              )}
            </CardContent>
          </Card>

          {isMaster && (
            <Card className="border-destructive/30">
              <CardContent className="p-4">
                <Button variant="outline" size="sm" className="text-destructive gap-1.5"
                  onClick={() => setShowDeleteHome(true)}>
                  <Trash2 className="h-4 w-4" /> Delete home
                </Button>
                <p className="text-2xs text-muted-foreground mt-2">Permanently removes this home and all its data.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Home users</CardTitle>
              {isMaster && (
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={() => toast.info("TODO: Add user flow")}>
                  <Plus className="h-4 w-4" /> Add user
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {currentHome.users.map(user => (
                <div key={user.email} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {user.name}
                        {user.role === "master" && <Crown className="h-3.5 w-3.5 text-warning" />}
                      </p>
                      <p className="text-2xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <StatusBadge variant={user.role === "master" ? "warning" : user.role === "guest" ? "info" : "online"}>
                    {user.role}
                  </StatusBadge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alarm */}
        <TabsContent value="alarm" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Alarm settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">PIN required</p>
                  <p className="text-2xs text-muted-foreground">Require PIN to disarm</p>
                </div>
                <Switch defaultChecked={currentHome.settings?.alarm?.pinRequired}
                  onCheckedChange={() => toast.success("Alarm setting updated")} disabled={!isMaster} />
              </div>
              <Separator />
              {currentHome.profiles && Object.entries(currentHome.profiles).map(([mode, settings]) => (
                <div key={mode} className="space-y-2">
                  <p className="text-sm font-medium capitalize">{mode}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-2xs text-muted-foreground">Entry delay</label>
                      <p className="font-medium">{settings.entryDuration}s</p>
                    </div>
                    <div>
                      <label className="text-2xs text-muted-foreground">Exit delay</label>
                      <p className="font-medium">{settings.exitDuration}s</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gateway */}
        <TabsContent value="gateway" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Gateway</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{currentHome.gateway.name}</p>
                  <p className="text-2xs text-muted-foreground">{currentHome.gateway.vendor} {currentHome.gateway.model} · v{currentHome.gateway.softwareVersion}</p>
                </div>
                <StatusBadge variant={currentHome.gateway.online ? "online" : "offline"}>
                  {currentHome.gateway.online ? "Online" : "Offline"}
                </StatusBadge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toast.success("Ping sent")}>Ping</Button>
                <Button size="sm" variant="outline" onClick={() => toast.info("Checking for updates…")}>Check updates</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={showDeleteHome} onOpenChange={setShowDeleteHome}
        title="Delete this home?" description="All devices, rooms, rules, and history will be permanently deleted."
        confirmLabel="Delete home" destructive
        onConfirm={() => { setShowDeleteHome(false); toast.success("Home deleted"); }} />
    </div>
  );
}
