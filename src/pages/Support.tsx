import { useApp } from "@/contexts/AppContext";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Home, Radio, Users, AlertTriangle, Shield,
  ExternalLink, Car, Database, TestTube, Clock,
} from "lucide-react";
import { mockHomes } from "@/mock/data";
import { toast } from "sonner";

export default function SupportPage() {
  const { currentUser } = useApp();

  if (currentUser.role !== "support" && currentUser.role !== "admin") {
    return <StateWrapper state="no-access"><div /></StateWrapper>;
  }

  const isAdmin = currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Support Dashboard</h1>
        <Badge variant="outline" className="text-2xs bg-warning/10 text-warning-foreground border-warning/30">
          {currentUser.role.toUpperCase()}
        </Badge>
      </div>

      <Tabs defaultValue="homes">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="homes" className="gap-1.5"><Home className="h-3.5 w-3.5" /> Homes</TabsTrigger>
          <TabsTrigger value="gateways" className="gap-1.5"><Radio className="h-3.5 w-3.5" /> Gateways</TabsTrigger>
          <TabsTrigger value="external" className="gap-1.5"><Car className="h-3.5 w-3.5" /> External</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="homes" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search homes by name or ID…" className="pl-9" />
          </div>
          {mockHomes.map(home => (
            <Card key={home.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{home.name}</p>
                    <p className="text-2xs text-muted-foreground">{home.id} · {home.address?.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant={home.gateway.online ? "online" : "offline"}>
                    GW {home.gateway.online ? "Online" : "Offline"}
                  </StatusBadge>
                  {home.warnings.length > 0 && (
                    <StatusBadge variant="warning">{home.warnings.length} warning{home.warnings.length !== 1 ? "s" : ""}</StatusBadge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="gateways" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Gateway management — search, diagnostics, restart coordinator</p>
              {/* TODO: Gateway list with support actions */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">External devices — EV chargers, connected services</p>
              {/* TODO: External device search */}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-4 space-y-4">
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-semibold">Production environment</p>
                  <p className="text-2xs text-muted-foreground">Changes here affect live systems. Proceed with caution.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TestTube className="h-4 w-4" /> Test Mode</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button size="sm" variant="outline" onClick={() => toast.success("Test mode created — expires in 1 hour")}>
                  Create Test Mode
                </Button>
                <p className="text-2xs text-muted-foreground">Test mode allows simulation without affecting production state.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Stromme</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Meter info and settings — internal only</p>
                {/* TODO: Stromme meter management */}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
