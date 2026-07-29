import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhuxiangjia.example"),
  title: {
    default: "筑想家 | 自建房智能方案",
    template: "%s · 筑想家",
  },
  description: "从标准 DXF 场地分析开始，建立统一、可追溯的自建房概念方案。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "筑想家",
    description: "从一张地块图，到可沟通的家",
    images: [{ url: "/og.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "筑想家",
    description: "从一张地块图，到可沟通的家",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
