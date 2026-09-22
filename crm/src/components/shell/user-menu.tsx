"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Settings, UserCog } from "lucide-react";
import { ROLE_LABEL } from "@/db/enums";
import { logout } from "@/server/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import type { SessionUser } from "@/lib/auth";

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex shrink-0 items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-canvas">
        <Avatar name={user.name} photoUrl={user.photoUrl} size="md" />
        <span className="hidden min-w-0 text-left lg:block">
          <span className="clip-1 max-w-32 text-[13px] font-medium text-ink">{user.name}</span>
          <span className="clip-1 text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="hidden size-4 shrink-0 text-muted lg:block" aria-hidden />
        <span className="sr-only">Abrir menu de cuenta</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="anim-in z-50 w-60 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
        >
          <div className="border-b border-line-soft px-2.5 pb-2.5 pt-1.5">
            <p className="clip-1 text-[14px] font-semibold text-ink">{user.name}</p>
            <p className="break-anywhere text-[12px] text-muted">{user.email}</p>
          </div>

          <DropdownMenu.Item asChild>
            <Link
              href="/ajustes/mi-cuenta"
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
            >
              <UserCog className="size-4 text-muted" aria-hidden />
              Mi cuenta
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/ajustes"
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
            >
              <Settings className="size-4 text-muted" aria-hidden />
              Ajustes
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />

          <form action={logout}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink hover:bg-danger-soft hover:text-danger"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
