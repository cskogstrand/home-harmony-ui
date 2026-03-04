import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Shield, Zap, Phone, ChevronRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  active: boolean;
  link?: string;
  badge?: string;
}

const services: ServiceItem[] = [
  {
    id: "alarm", name: "Alarm Service", icon: Shield, active: true, link: "/alarm",
    description: "Viking Guard alarm monitoring with 24/7 ARC response. Arm/disarm, manage profiles, and configure entry delays.",
    badge: "Active",
  },
  {
    id: "energy", name: "Energy Control", icon: Zap, active: true, link: "/energy",
    description: "Smart energy management. Automatically optimize heating, EV charging, and appliances based on electricity prices.",
    badge: "Active",
  },
  {
    id: "arc", name: "ARC Monitoring", icon: Phone, active: false,
    description: "Alarm Receiving Centre contact management. Configure emergency contacts and response priorities.",
  },
];

export default function ServicesPage() {
  const { currentHome } = useApp();
  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold">Services</h1>
      <p className="text-sm text-muted-foreground">Manage your smart home services and subscriptions.</p>

      <div className="space-y-3">
        {services.map((service, i) => (
          <motion.div key={service.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}>
            <Card className="hover:shadow-card-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${
                    service.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    <service.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{service.name}</h3>
                      {service.badge && (
                        <Badge variant={service.active ? "default" : "secondary"} className="text-2xs">
                          {service.active && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {service.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xs text-muted-foreground leading-relaxed">{service.description}</p>
                    <div className="mt-3">
                      {service.link ? (
                        <Link to={service.link}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            Manage <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => toast.info("Service activation flow (mock)")}>
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
