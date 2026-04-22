import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  resetTokenHash?: string | null;
  resetTokenExpires?: Date | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
