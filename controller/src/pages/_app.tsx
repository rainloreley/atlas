import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { GeistProvider, CssBaseline } from '@geist-ui/core'
import AppControlProvider from "@/appContextProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
      <AppControlProvider>
        <Component {...pageProps} />
      </AppControlProvider>
  )
}
