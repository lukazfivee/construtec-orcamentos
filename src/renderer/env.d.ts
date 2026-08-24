export {};

declare global {
  interface Window {
    construtec?: {
      runtime: () => Promise<{
        apiUrl?: string;
        apiToken?: string;
        platform: string;
        storage: 'local';
      }>;
    };
  }
}
