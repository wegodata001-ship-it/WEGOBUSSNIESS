import type { Metadata, Viewport } from "next";
import { Heebo, Noto_Sans_Arabic } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { APP_NAME } from "@/lib/env";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Multi-business operations platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F8FB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("wego.language");if(l==="ar"||l==="he"){document.documentElement.lang=l;document.documentElement.dir="rtl"}var a=JSON.parse(localStorage.getItem("wego.accessibility")||"{}");var r=document.documentElement;if(a.fontScale)r.style.setProperty("--accessibility-font-scale",String(a.fontScale));if(a.highContrast)r.setAttribute("data-a11y-contrast","on");if(a.grayscale)r.setAttribute("data-a11y-gray","on");if(a.highlightLinks)r.setAttribute("data-a11y-links","on");if(a.largeCursor)r.setAttribute("data-a11y-cursor","on");if(a.reduceMotion)r.setAttribute("data-a11y-motion","on");if(a.readableFont)r.setAttribute("data-a11y-readable","on")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${heebo.variable} ${arabic.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
