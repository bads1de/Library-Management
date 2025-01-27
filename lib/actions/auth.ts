"use server";

import { eq } from "drizzle-orm";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { hash } from "bcryptjs";
import { signIn } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import config from "@/lib/config";
import ratelimit from "../ratelimit";
import { workflowClient } from "../workflow";

/**
 * クレデンシャルを使用してサインインします。
 * @param params - メールアドレスとパスワードを含むパラメータ
 * @returns - サインインの成功または失敗を示すオブジェクト
 */
export const signInWithCredentials = async (
  params: Pick<AuthCredentials, "email" | "password">
) => {
  const { email, password } = params;

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error: any) {
    console.log(error, "Signin error");
    return { success: false, error: "Signin error" };
  }
};

/**
 * ユーザーをサインアップします。
 * @param params - フルネーム、メールアドレス、パスワード、大学ID、大学カードを含むパラメータ
 * @returns - サインアップの成功または失敗を示すオブジェクト
 */
export const signUp = async (params: AuthCredentials) => {
  const { fullName, email, password, universityId, universityCard } = params;

  const ip = (await headers()).get("x-forwarded-for") || "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return redirect("/too-fast");
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      success: false,
      error: "User already exists",
    };
  }

  const hashedPassword = await hash(password, 10);

  try {
    await db.insert(users).values({
      fullName,
      email,
      universityId,
      password: hashedPassword,
      universityCard,
    });

    await workflowClient.trigger({
      url: `${config.env.prodApiEndpoint}/api/workflows/onboarding`,
      body: {
        email,
        fullName,
      },
    });

    await signInWithCredentials({ email, password });

    return { success: true };
  } catch (error: any) {
    console.log(error, "Signup error");
    return { success: false, error: "Signup error" };
  }
};
