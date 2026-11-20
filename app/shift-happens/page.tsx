import type { Metadata } from "next";
import ShiftHappens from "./shift-happens";
import "./shift-happens.css";

export const metadata: Metadata = {
  title: "Shift Happens!",
  description: "A two-player party game about filling the weekly roster.",
};

export default function ShiftHappensPage() {
  return <ShiftHappens />;
}
