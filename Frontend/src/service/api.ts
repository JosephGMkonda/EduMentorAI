import axios from "axios";

const API_BASE = "http://localhost:8000/api";

export interface LessonResponse {
  query: string;
  subject: string;
  form_level: string;
  topic: string;
  math_solution: {
    equation: string;
    solutions: string[];
    factored_form: string;
  } | null;
  lesson: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface QuizResponse {
  topic: string;
  questions: QuizQuestion[];
}

export async function getQuiz(
  topic: string,
  subject: string,
  formLevel: string,
  query: string,
): Promise<QuizResponse> {
  const response = await axios.get<QuizResponse>(`${API_BASE}/quiz`, {
    params: { query, subject, form_level: formLevel, topic },
  });
  return response.data;
}

export async function getLesson(
  query: string,
  subject: string,
  formLevel: string,
  topic: string,
  a?: number,
  b?: number,
  c?: number,
): Promise<LessonResponse> {
  const params: Record<string, string> = { query, subject, form_level: formLevel, topic };
  if (a !== undefined && b !== undefined && c !== undefined) {
    params.a = String(a);
    params.b = String(b);
    params.c = String(c);
  }
  const response = await axios.get<LessonResponse>(`${API_BASE}/lesson`, { params });
  return response.data;
}

export interface PracticeProblem {
  id: number;
  problem: string;
  answer: string;
  explanation: string;
}

export interface PracticeResponse {
  topic: string;
  problems: PracticeProblem[];
}

export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getPractice(
  topic: string,
  subject: string,
  formLevel: string,
): Promise<PracticeResponse> {
  const response = await axios.get<PracticeResponse>(`${API_BASE}/practice`, {
    params: { topic, subject, form_level: formLevel },
  });
  return response.data;
}

export async function checkPracticeAnswer(payload: {
  problem: string;
  answer: string;
  explanation: string;
  student_answer: string;
  topic: string;
}): Promise<{ correct: boolean; feedback: string }> {
  const response = await axios.post<{ correct: boolean; feedback: string }>(
    `${API_BASE}/practice/check`,
    payload,
  );
  return response.data;
}

export async function getFollowUp(payload: {
  query: string;
  subject: string;
  form_level: string;
  topic: string;
  lesson_excerpt: string;
  history: FollowUpMessage[];
}): Promise<{ reply: string }> {
  const response = await axios.post<{ reply: string }>(
    `${API_BASE}/followup`,
    payload,
  );
  return response.data;
}
