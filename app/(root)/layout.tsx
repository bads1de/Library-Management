import { auth } from "@/auth";
import Header from "@/components/Header";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import React, { ReactNode } from "react";

const Layout = async ({ children }: { children: ReactNode }) => {
  const session = await auth();

  if (!session) {
    return redirect("/sign-in");
  }

  // ユーザーの最終アクティビティ日を更新する処理
  after(async () => {
    // セッションにユーザーIDが存在しない場合は処理を終了
    if (!session?.user?.id) return;

    // データベースから現在のユーザー情報を取得
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session?.user?.id))
      .limit(1);

    // 今日の日付が既に最終アクティビティ日として記録されている場合は更新不要
    if (user[0].lastActivityDate === new Date().toISOString().slice(0, 10))
      return;

    // 最終アクティビティ日を今日の日付に更新
    await db
      .update(users)
      .set({ lastActivityDate: new Date().toISOString().slice(0, 10) })
      .where(eq(users.id, session?.user?.id));
  });

  return (
    <main className="root-container">
      <div className="mx-auto max-w-7xl">
        <Header />
        <div className="mt-20 pb-20">{children}</div>
      </div>
    </main>
  );
};

export default Layout;
