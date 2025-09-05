import React from 'react';
import { Button } from '@servota/ui';

export default function App() {
  return (
    <div
      style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}
    >
      <h1>Servota Web</h1>
      <p>Monorepo scaffold OK — shared packages wired up.</p>
      <Button onClick={() => alert('Hello from @servota/ui')}>Test UI Button</Button>
    </div>
  );
}
