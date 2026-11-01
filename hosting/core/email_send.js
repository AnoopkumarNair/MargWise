// Sending the sign-in email (BACKEND ADR-04, ADR-18). A mailer is {send({to, subject, text})}: it resolves when the message is accepted
// and throws when it is not. The handler turns a throw into `unavailable` ("We could not send your code").
//   Dry run (EMAIL_DRY_RUN on; the default everywhere except production): the message is kept in memory in mailer.outbox and nothing is sent.
//   It is never written to a log. For a local demo, set EMAIL_DRY_RUN_PRINT=1 and the code and link go to the local console only.
//   Real: Cloudflare Email Service, through a binding named EMAIL (see wrangler.toml). The exact binding call is the one in Cloudflare's
//   Email Service documentation (send with from, to, subject, text); check it on the preview deployment before the pilot (deviations.md).
export function makeDryRunMailer({ print = false, sink = console.log } = {}) {
  const outbox = [];
  return { dryRun: true, outbox, async send(msg) { outbox.push({ to: msg.to, subject: msg.subject, text: msg.text }); if (print) sink('[dry run email] ' + msg.text); } };
}
export function makeMailer(env, config) {
  const binding = env && env.EMAIL, from = config && config.emailFrom;
  if (!binding || typeof binding.send !== 'function' || !from) return null;
  return { dryRun: false, async send(msg) { await binding.send({ from, to: msg.to, subject: msg.subject, text: msg.text }); } };
}

// The plain-language email. The code and the link are the only two things in it that matter; nothing says whether the address had an account.
export function codeMessage({ to, code, link }) {
  return {
    to,
    subject: 'Your Margwise sign-in code',
    text: `Your Margwise code is ${code}\n\nIt works for 15 minutes. Type it in the page you have open, or open this link to sign in on the device where you open it:\n${link}\n\nIf you did not ask for this, you can ignore this email. Nobody can sign in without the code.\n`,
  };
}
