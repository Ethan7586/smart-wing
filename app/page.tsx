import { headers } from "next/headers";
import App from "../src/App";

export default async function Home() {
  const requestHeaders = await headers();
  return <App initialHost={requestHeaders.get("host") ?? ""} />;
}
