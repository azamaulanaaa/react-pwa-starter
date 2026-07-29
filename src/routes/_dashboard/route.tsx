import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { House } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar.tsx";
import { useTranslation } from "@/components/context/i18n.tsx";
import { useConfig } from "@/components/context/config.tsx";

function Page() {
  const { t } = useTranslation("ui");
  const { config, updateConfig } = useConfig();

  const [isSidebarOpen, setLocalIsSidebarOpen] = useState(config.isSidebarOpen);
  const setIsSidebarOpen = useCallback(
    (
      state: boolean,
    ) => {
      setLocalIsSidebarOpen(state);
      updateConfig({ isSidebarOpen: state });
    },
    [updateConfig, setLocalIsSidebarOpen],
  );

  useEffect(() => {
    const handleFocus = () => updateConfig({ isSidebarOpen });

    // deno-lint-ignore no-window no-window-prefix
    window.addEventListener("focus", handleFocus);
    // deno-lint-ignore no-window no-window-prefix
    return () => window.removeEventListener("focus", handleFocus);
  }, [isSidebarOpen, updateConfig]);

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      >
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-1 py-1 font-semibold">
              <img
                src="/icon.svg"
                alt="Logo"
                className="size-6 shrink-0 object-contain"
              />
              <span className="truncate">REACT PWA</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={t("layout_menu_home")}
                    >
                      <House />
                      <span>{t("layout_menu_home")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </div>
          <main className="p-2">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

export const Route = createFileRoute("/_dashboard")({
  component: Page,
});
