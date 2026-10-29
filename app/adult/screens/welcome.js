import { h } from '../dom.js';

export function title() { return 'Welcome'; }
export async function render() {
  return h('section', { class: 'screen' },
    h('h1', { tabindex: '-1' }, 'Find your next move from the job you do today'),
    h('p', { class: 'lead' }, 'Share your resume, or type your job title. Then see the jobs you could move to, and what you would still need to learn.'),
    h('h2', null, 'What you get'),
    h('ul', { class: 'plain' },
      h('li', null, 'The jobs and skills we found in your resume, for you to check and fix.'),
      h('li', null, 'A list of jobs near yours, from close moves to big leaps.'),
      h('li', null, 'For each job: how much of it you already cover, and the top skills still missing.'),
      h('li', null, 'The reasons behind the order. You can change what matters to you.')),
    h('p', null, 'It takes a few minutes.'),
    h('p', { class: 'privacy' }, h('strong', null, 'Your privacy: '), 'no sign-in. Your resume is read in your browser. Nothing leaves your device. What you share stays on this page. Nothing is stored on a server. Close the tab and it is gone.'),
    h('p', null, h('a', { class: 'btn primary', href: '#/intake', id: 'start' }, 'Start')));
}
