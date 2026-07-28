import { useEffect, useRef } from "react";

export default function useQuestionTimeTracking({
  active,
  questions,
  currentQuestionIndex,
  initialTimes = {},
}) {
  const timesRef = useRef({ ...initialTimes });
  const enteredAtRef = useRef(null);
  const activeQuestionIdRef = useRef(null);

  useEffect(() => {
    if (!active) {
      enteredAtRef.current = null;
      activeQuestionIdRef.current = null;
      return;
    }

    const question = questions[currentQuestionIndex];
    const questionId = question?.id;

    if (!questionId) return;

    enteredAtRef.current = Date.now();
    activeQuestionIdRef.current = questionId;

    return () => {
      const previousId = activeQuestionIdRef.current;
      const enteredAt = enteredAtRef.current;

      if (previousId && enteredAt) {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - enteredAt) / 1000)
        );
        timesRef.current[previousId] =
          (timesRef.current[previousId] || 0) + elapsed;
      }
    };
  }, [active, currentQuestionIndex, questions]);

  const flushCurrentQuestionTime = () => {
    const questionId = activeQuestionIdRef.current;
    const enteredAt = enteredAtRef.current;

    if (!questionId || !enteredAt) return;

    const elapsed = Math.max(0, Math.floor((Date.now() - enteredAt) / 1000));
    timesRef.current[questionId] = (timesRef.current[questionId] || 0) + elapsed;
    enteredAtRef.current = Date.now();
  };

  const getTimesSnapshot = () => ({ ...timesRef.current });

  const replaceTimes = (nextTimes = {}) => {
    timesRef.current = { ...nextTimes };
  };

  return {
    flushCurrentQuestionTime,
    getTimesSnapshot,
    replaceTimes,
  };
}
