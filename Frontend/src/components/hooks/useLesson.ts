import { useState } from "react";
import { getLesson } from "../../service/api";
import type { LessonResponse } from "../../service/api";

export function useLesson() {
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLesson = async (
    query: string,
    subject: string,
    formLevel: string,
    topic: string,
    a?: number,
    b?: number,
    c?: number,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLesson(query, subject, formLevel, topic, a, b, c);
      setLesson(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
      setLesson(null);
    } finally {
      setLoading(false);
    }
  };

  return { lesson, loading, error, fetchLesson };
}
