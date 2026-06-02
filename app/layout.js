import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'MentorX · 简历石沉大海?大厂导师智慧核心联合帮你升级',
  description: '1,300+ 大厂导师实战经验 × AI 精准分析,30 秒拿到可落地的优化方案。',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="theme-color" content="#f6f3ec" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Script src="/assets/api-client.js" strategy="afterInteractive" />
        <Script src="/assets/app.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
