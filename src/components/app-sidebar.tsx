"use client";

import Image from "next/image";
import { LayoutDashboardIcon, Building2Icon, UsersIcon, LogOutIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { logout } from "@/app/[locale]/login/actions";

type NavItem = {
  href: "/dashboard" | "/organizations" | "/contacts";
  label: string;
  icon: React.ReactNode;
};

export function AppSidebar({
  locale,
  navLabels,
  profileName,
  logoutLabel,
}: {
  locale: string;
  navLabels: { dashboard: string; organizations: string; contacts: string };
  profileName: string;
  logoutLabel: string;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: navLabels.dashboard,
      icon: <LayoutDashboardIcon aria-hidden="true" />,
    },
    {
      href: "/contacts",
      label: navLabels.contacts,
      icon: <UsersIcon aria-hidden="true" />,
    },
    {
      href: "/organizations",
      label: navLabels.organizations,
      icon: <Building2Icon aria-hidden="true" />,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Image src="/logo.png" alt="ABVCAP" width={96} height={40} />
      </SidebarHeader>
      <SidebarContent role="navigation">
        <SidebarGroup>
          <SidebarGroupLabel>CRM ABVCAP</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <span className="truncate px-2 text-sm text-sidebar-foreground/70">
              {profileName}
            </span>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={logout.bind(null, locale)}>
              <SidebarMenuButton type="submit">
                <LogOutIcon aria-hidden="true" />
                <span>{logoutLabel}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
