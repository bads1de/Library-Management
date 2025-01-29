import dummyBooks from "../dummybooks.json";
import ImageKit from "imagekit";
import { books } from "@/database/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
});

/**
 * ImageKitにファイルをアップロードする非同期関数
 *
 * @param {string} url - アップロードするファイルのURL
 * @param {string} fileName - アップロード後のファイル名
 * @param {string} folder - アップロード先のフォルダパス
 * @returns {Promise<string | undefined>} - アップロード成功時はファイルパスを返す。エラー時はundefinedを返す
 *
 * @example
 * const coverUrl = await uploadToImageKit(
 *   "https://example.com/image.jpg",
 *   "example.jpg",
 *   "books/covers"
 * );
 */
const uploadToImageKit = async (
  url: string,
  fileName: string,
  folder: string
): Promise<string | undefined> => {
  try {
    const response = await imagekit.upload({
      file: url,
      fileName,
      folder,
    });

    return response.filePath;
  } catch (error) {
    console.log("ImageKitアップロードエラー", error);
    return undefined;
  }
};

/**
 * dummyBooks.jsonに含まれる本の情報をDBに登録する
 */
const seed = async () => {
  console.log("seeding...");

  try {
    for (const book of dummyBooks) {
      const coverUrl = (await uploadToImageKit(
        book.coverUrl,
        `${book.title}.jpg`,
        "books/covers"
      )) as string;

      const videoUrl = (await uploadToImageKit(
        book.videoUrl,
        `${book.title}.mp4`,
        "books/videos"
      )) as string;

      await db.insert(books).values({
        ...book,
        coverUrl,
        videoUrl,
      });
    }

    console.log("seeding complete");
  } catch (error) {
    console.log("seeding error", error);
  }
};

seed();
