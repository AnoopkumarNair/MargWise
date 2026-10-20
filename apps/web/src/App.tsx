import { t } from '@margwise/i18n';

/** Phase 0 shell. The welcome-and-consent flow lands in Phase 6/8. */
export function App() {
  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p>{t('app.shell.notice')}</p>
    </main>
  );
}
