"use server";

import { db } from "@/database/drizzle";
import { books, borrowRecords } from "@/database/schema";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";

/**
 * 本を借りる処理を行う関数
 *
 * @param params - 借りる本とユーザーの情報を含むオブジェクト
 * @param params.userId - 本を借りるユーザーのID
 * @param params.bookId - 借りる本のID
 *
 * @returns {Promise<{success: boolean, data?: any, error?: string}>} - 処理結果を返すPromise
 *   - success: 処理が成功したかどうか
 *   - data: 成功時の貸出記録データ
 *   - error: 失敗時のエラーメッセージ
 *
 * @throws {Error} データベース操作中にエラーが発生した場合
 *
 * 処理の流れ:
 * 1. 指定された本の在庫状況を確認
 * 2. 在庫がない場合はエラーを返す
 * 3. 返却期限日を7日後に設定
 * 4. 貸出記録を作成
 * 5. 本の在庫数を更新
 * 6. 処理結果を返す
 */
export const borrowBook = async (params: BorrowBookParams) => {
  const { userId, bookId } = params;

  try {
    // 本の在庫状況を取得
    const book = await db
      .select({ availableCopies: books.availableCopies })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    // 在庫がない場合のエラーハンドリング
    if (!book.length || book[0].availableCopies <= 0) {
      return {
        success: false,
        error: "Book is not available for borrowing",
      };
    }

    // 返却期限日を7日後に設定
    const dueDate = dayjs().add(7, "day").toDate().toDateString();

    // 貸出記録を作成
    const record = await db.insert(borrowRecords).values({
      userId,
      bookId,
      dueDate,
      status: "BORROWED",
    });

    // 本の在庫数を更新
    await db
      .update(books)
      .set({ availableCopies: book[0].availableCopies - 1 })
      .where(eq(books.id, bookId));

    // 成功時のレスポンス
    return {
      success: true,
      data: JSON.parse(JSON.stringify(record)),
    };
  } catch (error) {
    console.log(error);

    // エラー時のレスポンス
    return {
      success: false,
      error: "An error occurred while borrowing the book",
    };
  }
};
