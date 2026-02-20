export const metadata = { title: 'Admin - Explorador Inmobiliario' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
}
