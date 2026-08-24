export {};

declare global {
  interface Window {
    construtec?: {
      runtime: () => Promise<{
        apiUrl?: string;
        platform: string;
        storage: 'local';
      }>;
    };
  }
}
