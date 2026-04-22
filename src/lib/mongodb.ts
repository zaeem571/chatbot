import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

const cached = (global as Record<string, unknown>).__mongoose as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
} | undefined;

const mongoCache = cached ?? { conn: null, promise: null };
(global as Record<string, unknown>).__mongoose = mongoCache;

export default async function dbConnect() {
  if (mongoCache.conn) return mongoCache.conn;

  if (!mongoCache.promise) {
    mongoCache.promise = mongoose.connect(MONGODB_URI, { dbName: "ai-chatbot" }).catch((err) => {
      // Reset promise so next call retries instead of caching the failure
      mongoCache.promise = null;
      throw err;
    });
  }

  mongoCache.conn = await mongoCache.promise;
  return mongoCache.conn;
}
