import WebApp from '@twa-dev/sdk';

export function getTelegramInitData(): string | undefined {
  const initData = WebApp.initData;
  return initData && initData.length > 0 ? initData : undefined;
}

export function isTelegramEnvironment(): boolean {
  return getTelegramInitData() !== undefined;
}

export function telegramReady(): void {
  WebApp.ready();
  WebApp.expand();
}

export function showBackButton(onClick: () => void): void {
  WebApp.BackButton.onClick(onClick);
  WebApp.BackButton.show();
}

export function hideBackButton(): void {
  WebApp.BackButton.hide();
}
