export class CourseProgress {
  constructor(key, lessonCount, onChange = () => {}) {
    this.key = `createaccess-course-${key}`;
    this.lessonCount = lessonCount;
    this.onChange = onChange;
    this.state = this.read();
  }

  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key));
      if (saved && Array.isArray(saved.complete)) {
        return {
          active: Math.min(Math.max(Number(saved.active) || 0, 0), this.lessonCount - 1),
          complete: Array.from({ length: this.lessonCount }, (_, index) => Boolean(saved.complete[index]))
        };
      }
    } catch {
      // A malformed or unavailable local store should never block a lesson.
    }
    return { active: 0, complete: Array(this.lessonCount).fill(false) };
  }

  write() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      // Progress still works for the current session when storage is unavailable.
    }
    this.onChange(this.state);
  }

  setActive(index) {
    this.state.active = Math.min(Math.max(index, 0), this.lessonCount - 1);
    this.write();
  }

  markComplete(index) {
    this.state.complete[index] = true;
    this.write();
  }

  reset() {
    this.state = { active: 0, complete: Array(this.lessonCount).fill(false) };
    this.write();
  }

  get completedCount() {
    return this.state.complete.filter(Boolean).length;
  }
}

export function renderCourseProgress(progress, tabs, fill, copy) {
  tabs.forEach((tab, index) => {
    tab.classList.toggle("active", progress.state.active === index);
    tab.classList.toggle("complete", progress.state.complete[index]);
  });
  const completed = progress.completedCount;
  fill.style.width = `${(completed / progress.lessonCount) * 100}%`;
  copy.textContent = `${completed} / ${progress.lessonCount} complete`;
}
