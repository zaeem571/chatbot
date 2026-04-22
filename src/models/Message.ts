import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  role: string;
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    role: { type: String, required: true },
    parts: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: false },
);

export default mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);
