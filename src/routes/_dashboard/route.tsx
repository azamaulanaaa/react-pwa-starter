import { ElementType, Fragment, useCallback, useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  LinkProps,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb.tsx";

type SidebarLinkProps = LinkProps & {
  icon: ElementType;
  label: string;
};

export function SidebarLink({
  icon: Icon,
  label,
  ...props
}: SidebarLinkProps) {
  return (
    <SidebarMenuItem>
      <Link {...props}>
        {({ isActive }) => (
          <SidebarMenuButton isActive={isActive} tooltip={label}>
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        )}
      </Link>
    </SidebarMenuItem>
  );
}

function Page() {
  const { t } = useTranslation("ui");
  const { config, updateConfig } = useConfig();
  const matches = useMatches();

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

  const breadcrumbs = matches
    .filter((match) => match.staticData?.breadcrumb)
    .filter((match, index, array) => {
      const nextMatch = array[index + 1];
      return !nextMatch || nextMatch.pathname !== match.pathname;
    })
    .map((match) => {
      const { breadcrumb } = match.staticData;
      const label = (typeof breadcrumb === "function")
        ? breadcrumb(match)
        : breadcrumb;

      return {
        title: label,
        path: match.pathname,
      };
    });

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
                  <SidebarLink
                    icon={House}
                    label={t("layout_menu_home")}
                    to="/"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex flex-row h-12 items-center border-b px-4">
            <div className="flex gap-2 items-center">
              <SidebarTrigger />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    return (
                      <Fragment key={crumb.path}>
                        {isLast
                          ? (
                            <BreadcrumbItem>
                              <BreadcrumbPage>
                                {crumb.title}
                              </BreadcrumbPage>
                            </BreadcrumbItem>
                          )
                          : (
                            <BreadcrumbItem>
                              <BreadcrumbLink render={<Link to={crumb.path} />}>
                                {crumb.title}
                              </BreadcrumbLink>
                            </BreadcrumbItem>
                          )}
                        {!isLast && <BreadcrumbSeparator />}
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div>
            </div>
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
  staticData: {
    breadcrumb: "Dashboard",
  },
});
