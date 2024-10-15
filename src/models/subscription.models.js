import mongoose, { Schema } from "mongoose";
import { type } from "os";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, //onew who is subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, //onew to whom 'subscriber' is subscribing
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
