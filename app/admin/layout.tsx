import React, { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import "@/styles/admin.css";

const layout = async ({ children }: { children: ReactNode }) => {
  const session = await auth();

  if (!session?.user?.id) {
    return redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen w-full flex-row">
      <div className="admin-container">{children}</div>
    </main>
  );
};

export default layout;
