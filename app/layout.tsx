export const metadata = {
  title: 'MeiNu — оптовые поставки beauty из Китая',
  description: 'B2B-маркетплейс beauty-товаров из Китая. Прозрачная цена с доставкой, белая поставка с документами, сроки 15–25 дней.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
