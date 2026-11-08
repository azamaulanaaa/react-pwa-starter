import type * as React from "react";
import { LogOutIcon } from "lucide-react";

import { useSession } from "@/components/context/session.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu.tsx";
import type { SessionUser } from "@/lib/auth/types.ts";

export interface UserMenuProps {
  user: SessionUser;
  onSignOut?: () => void | Promise<void>;
  onProfile?: () => void;
  signOutLoading?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

export function UserMenu({
  user,
  onSignOut,
  onProfile,
  signOutLoading = false,
  align = "end",
  side = "bottom",
}: UserMenuProps): React.ReactElement {
  const { t } = useTranslation();
  const displayName = user.name?.trim() || user.email?.trim() || "";
  const initial = displayName.slice(0, 1).toUpperCase() || "?";

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("auth_menu_label")}
        data-slot="user-menu-trigger"
        render={<Button size="icon" variant="ghost" />}
      >
        <Avatar className="size-7 sm:size-6">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuPopup align={align} className="w-56" side={side}>
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          {user.name && (
            <span className="truncate font-medium text-foreground text-sm">
              {t("auth_signed_in_as", { name: user.name })}
            </span>
          )}
          {user.email && (
            <span className="truncate text-muted-foreground text-xs">
              {user.email}
            </span>
          )}
        </div>
        <MenuSeparator />
        {onProfile && (
          <MenuItem onClick={onProfile}>{t("auth_profile")}</MenuItem>
        )}
        <MenuItem
          disabled={signOutLoading}
          onClick={() => {
            void onSignOut?.();
          }}
          variant="destructive"
        >
          <LogOutIcon aria-hidden="true" />
          {t("auth_sign_out")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

export type SessionUserMenuProps = Omit<UserMenuProps, "user" | "onSignOut">;

export function SessionUserMenu(
  props: SessionUserMenuProps,
): React.ReactElement | null {
  const { session, logout } = useSession();

  if (session === null) return null;

  return <UserMenu {...props} onSignOut={logout} user={session.user} />;
}
