// upstash workflowとdrizzle、カスタムライブラリから必要なモジュールをインポートします
import { serve } from "@upstash/workflow/nextjs";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/workflow";

type UserState = "non-active" | "active";

// ワークフローの初期データ構造を定義します
type InitialData = {
  email: string;
  fullName: string;
};

// ミリ秒単位での時間定数を定義します
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_IN_MS = 3 * ONE_DAY_IN_MS;
const THIRTY_DAYS_IN_MS = 30 * ONE_DAY_IN_MS;

/**
 * メールアドレスを指定して、ユーザーの状態を取得します
 * @param email メールアドレス
 * @returns ユーザーの状態 (active | non-active)
 */
const getUserState = async (email: string): Promise<UserState> => {
  // メールアドレスでユーザーを検索するためにデータベースをクエリします
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // ユーザーが見つからない場合は "non-active" を返します
  if (user.length === 0) return "non-active";

  // 最終アクティビティの日付を取得し、時間差を計算します
  const lastActivityDate = new Date(user[0].lastActivityDate!);
  const now = new Date();
  const timeDifference = now.getTime() - lastActivityDate.getTime();

  // 時間差が3日から30日の間の場合、"non-active" を返します
  if (
    timeDifference > THREE_DAYS_IN_MS &&
    timeDifference <= THIRTY_DAYS_IN_MS
  ) {
    return "non-active";
  }

  // それ以外の場合は "active" を返します
  return "active";
};

export const { POST } = serve<InitialData>(async (context) => {
  // リクエストペイロードからメールアドレスとフルネームを抽出します
  const { email, fullName } = context.requestPayload;

  // "new-signup" ワークフローステップを実行します
  await context.run("new-signup", async () => {
    // ユーザーにウェルカムメールを送信します
    await sendEmail({
      email,
      subject: "プラットフォームへようこそ",
      message: `ようこそ ${fullName} さん!`,
    });
  });

  // 3日間スリープします
  await context.sleep("wait-for-3-days", 60 * 60 * 24 * 3);

  // ユーザーの状態を確認し、メールを送信する無限ループを開始します
  while (true) {
    // "check-user-state" ワークフローステップを実行します
    const state = await context.run("check-user-state", async () => {
      return await getUserState(email);
    });

    // ユーザーが "non-active" の場合、リマインダーメールを送信します
    if (state === "non-active") {
      await context.run("send-email-non-active", async () => {
        await sendEmail({
          email,
          subject: "まだいらっしゃいますか？",
          message: `こんにちは ${fullName} さん、お元気ですか？`,
        });
      });
    } else if (state === "active") {
      // ユーザーが "active" の場合、ウェルカムバックメールを送信します
      await context.run("send-email-active", async () => {
        await sendEmail({
          email,
          subject: "おかえりなさい！",
          message: `おかえりなさい ${fullName} さん！`,
        });
      });
    }

    // 次のチェックまで30日間スリープします
    await context.sleep("wait-for-1-month", 60 * 60 * 24 * 30);
  }
});
