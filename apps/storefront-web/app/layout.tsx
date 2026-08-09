import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '智慧翼企业福利商城',
  description: '面向企业员工的福利商品、卡券、生活服务和订单管理平台，由雍彻科技提供技术服务。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
