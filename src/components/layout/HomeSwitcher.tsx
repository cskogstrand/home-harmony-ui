import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
export function HomeSwitcher() {
  const { currentHome } = useApp();
  return <Link to="/settings" className="flex items-center gap-2 font-semibold text-sm"><Home className="h-4 w-4" />{currentHome.name}</Link>;
}
