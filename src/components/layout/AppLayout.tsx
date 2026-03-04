import { Outlet } from "react-router-dom";
import { MobileNav, DesktopSidebarNav } from "./Navigation";
import { HomeSwitcher } from "./HomeSwitcher";
import { ConnectionBanner, SyncIndicator } from "@/components/common/ConnectionBanner";
import { useApp } from "@/contexts/AppContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/mock/data";

const roleLabels: Record<UserRole, string> = {
  user: "Home User",
  master: "Master",
  support: "Support",
  admin: "Admin",
};

export function AppLayout() {
  const { currentUser, setUserRole } = useApp();
  const initials = currentUser.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r bg-sidebar shrink-0">
        <div className="p-3 border-b">
          <HomeSwitcher />
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <DesktopSidebarNav />
        </div>
        <div className="border-t p-3">
          <SyncIndicator />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <ConnectionBanner />

        {/* Top header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card/95 backdrop-blur-md px-4 h-14">
          <div className="md:hidden">
            <HomeSwitcher />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <DropdownMenu>
              <DropdownMenuTrigger className="touch-target rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{currentUser.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Switch role (demo)</DropdownMenuLabel>
                {(["user", "master", "support", "admin"] as UserRole[]).map(role => (
                  <DropdownMenuItem key={role} onClick={() => setUserRole(role)} className="gap-2">
                    {roleLabels[role]}
                    {currentUser.role === role && <Badge variant="secondary" className="ml-auto text-2xs">Active</Badge>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </div>
  );
}
