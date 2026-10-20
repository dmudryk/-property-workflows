import { redirect } from "next/navigation";

// Головна сторінка — список запусків (зріз WS6). Вхід перевіряє /runs (getClaims()).
export default function Home() {
  redirect("/runs");
}
