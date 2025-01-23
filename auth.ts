import NextAuth, { User } from "next-auth";
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt", // JWTを使用してセッションを管理
  },
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null; // メールアドレスまたはパスワードが未入力の場合
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.toString()))
          .limit(1);

        if (user.length === 0) return null; // ユーザーが見つからない場合

        const isPasswordValid = await compare(
          credentials.password.toString(),
          user[0].password
        );

        if (!isPasswordValid) return null; // パスワードが一致しない場合

        return {
          id: user[0].id.toString(),
          email: user[0].email,
          name: user[0].fullName,
        } as User;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in", // サインインページのパス
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // トークンにユーザーIDを設定
        token.name = user.name; // トークンにユーザー名を設定
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string; // セッションにユーザーIDを設定
        session.user.name = token.name as string; // セッションにユーザー名を設定
      }

      return session;
    },
  },
});
