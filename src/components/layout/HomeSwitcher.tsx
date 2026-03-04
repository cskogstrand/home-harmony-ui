import { useApp } from "@/contexts/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home } from "lucide-react";

export function HomeSwitcher() {
  const { homes, currentHome, selectHome } = useApp();

  if (!currentHome) return null;

  return (
    <Select value={currentHome.id} onValueChange={selectHome}>
      <SelectTrigger className="w-full border-0 bg-transparent px-2 h-10 gap-2 font-semibold text-sm focus:ring-0 focus:ring-offset-0">
        <Home className="h-4 w-4 text-primary shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {homes.map(h => (
          <SelectItem key={h.id} value={h.id}>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${h.gateway.online ? "bg-success" : "bg-muted-foreground/40"}`} />
              {h.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
