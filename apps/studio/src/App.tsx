import { t } from '@margwise/i18n';

/** Phase 0 shell. Auth, review queue and release builder land in Phase 3. */
export function App() {
  return (
    <main>
      <h1>{t('studio.title')}</h1>
      <p>{t('app.shell.notice')}</p>
    </main>
  );
}
