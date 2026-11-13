// A single lesson page.

import { getLesson, nextLesson, prevLesson } from '../content/curriculum.js';
import { h, icon } from '../dom.js';
import { isDone, setProgress } from '../store.js';
import { renderBlocks } from '../ui/blocks.js';

export function lessonView(id) {
  const lesson = getLesson(id);
  if (!lesson) {
    return h('div', { class: 'page' }, h('h1', {}, 'Lesson not found'), h('p', {}, h('a', { href: '#/' }, 'Back to the course')));
  }
  const prev = prevLesson(id);
  const next = nextLesson(id);

  const doneBtn = h('button', { class: 'btn btn-lg', type: 'button' });
  const nudge = h('p', { class: 'done-nudge', hidden: true }, 'Quiz passed — nice. Mark the lesson complete when you have played the guitar tasks too.');
  const paintDone = () => {
    const done = isDone(id);
    doneBtn.replaceChildren(icon('check', 18), done ? 'Completed' : 'Mark lesson complete');
    doneBtn.classList.toggle('btn-done', done);
    if (done) nudge.hidden = true;
  };
  doneBtn.addEventListener('click', () => {
    setProgress(id, { done: !isDone(id) });
    paintDone();
  });
  paintDone();

  const body = h('div', { class: 'lesson-body' });
  body.append(renderBlocks(lesson.blocks, {
    lessonId: id,
    onPass: () => {
      setProgress(id, { quiz: true });
      if (!isDone(id)) nudge.hidden = false;
    },
  }));

  return h('article', { class: 'page lesson' },
    h('header', { class: 'lesson-head' },
      h('p', { class: 'eyebrow' }, `${lesson.module.title} · Lesson ${lesson.number} · ${lesson.minutes} min`),
      h('h1', {}, lesson.title),
      h('p', { class: 'lesson-summary' }, lesson.summary)),
    body,
    h('footer', { class: 'lesson-foot' },
      nudge,
      h('div', { class: 'lesson-done' }, doneBtn),
      h('nav', { class: 'lesson-nav' },
        prev ? h('a', { class: 'nav-card', href: `#/lesson/${prev.id}` }, h('small', {}, icon('left', 14), 'Previous'), prev.title) : h('span', {}),
        next
          ? h('a', { class: 'nav-card next', href: `#/lesson/${next.id}` }, h('small', {}, 'Next', icon('right', 14)), next.title)
          : h('a', { class: 'nav-card next', href: '#/studio' }, h('small', {}, 'Next', icon('right', 14)), 'Go and write songs'))));
}
