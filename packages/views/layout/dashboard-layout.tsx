"use client";

import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@multica/ui/components/ui/sidebar";
import { ModalRegistry } from "../modals/registry";
import { AppSidebar } from "./app-sidebar";
import { DashboardGuard } from "./dashboard-guard";
import { EmergencyBanner } from "./components/emergency-banner";
import { BrainDumpFab } from "../brain-dump/components/brain-dump-fab";

interface DashboardLayoutProps {
  children: ReactNode;
  /** Sibling of SidebarInset (e.g. SearchCommand, ChatWindow) */
  extra?: ReactNode;
  /** Rendered inside sidebar header as a search trigger */
  searchSlot?: ReactNode;
  /** Loading indicator */
  loadingIndicator?: ReactNode;
}

export function DashboardLayout({
  children,
  extra,
  searchSlot,
  loadingIndicator,
}: DashboardLayoutProps) {
  return (
    <DashboardGuard
      loginPath="/login"
      loadingFallback={
        <div className="flex h-svh items-center justify-center">
          {loadingIndicator}
        </div>
      }
    >
      <div className="flex flex-col h-svh">
        <EmergencyBanner />
        <SidebarProvider className="flex-1 min-h-0">
          <AppSidebar searchSlot={searchSlot} />
          <SidebarInset className="overflow-hidden">
            <div className="flex h-10 shrink-0 items-center border-b px-2 md:hidden">
              <SidebarTrigger />
            </div>
            {children}
            <ModalRegistry />
          </SidebarInset>
          {extra}
          <BrainDumpFab />
        </SidebarProvider>
      </div>
    </DashboardGuard>
  );
}
