import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider } from "@/contexts/FirebaseContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <FirebaseProvider>
      <Component {...pageProps} />
      <Toaster />
    </FirebaseProvider>
  );
}