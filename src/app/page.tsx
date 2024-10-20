// src/app/page.tsx
import Upload from '@/app/components/upload';

export default function Home() {
  return (
    <main className="flex items-center justify-center w-full h-screen bg-gray-100 dark:bg-slate-900">
      <Upload />
    </main>
  );
}
