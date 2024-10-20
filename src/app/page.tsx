// src/app/page.tsx
import RandomBackground from '@/app/components/RandomBackground';
import Upload from '@/app/components/upload';

export default function Home() {
  return (
    <RandomBackground>
      <Upload />
    </RandomBackground>
  );
}
