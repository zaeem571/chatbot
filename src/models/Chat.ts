import mongoose, { Schema, Document } from "mongoose";

export interface IChat extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  updatedAt: number;
}

const ChatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "New Chat" },
    updatedAt: { type: Number, default: Date.now },
  },
  { timestamps: false },
);

export default mongoose.models.Chat ||
  mongoose.model<IChat>("Chat", ChatSchema);
