const palette = ["#B9A5FF", "#74E5C2", "#FFB38A", "#75B6FF", "#F49AC1", "#E6D27A"];

/** Stable per-course colors: the same course keeps its color as tasks change order. */
export function courseColorMap(courses: string[]): (course: string) => string {
  const sorted = [...new Set(courses)].sort((a, b) => a.localeCompare(b));
  const map = new Map(sorted.map((course, index) => [course, palette[index % palette.length]]));
  return (course) => map.get(course) ?? palette[0];
}
