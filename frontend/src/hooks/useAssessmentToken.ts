import { useSearchParams } from 'react-router-dom';

export function useAssessmentToken(): string | null {
  const [searchParams] = useSearchParams();
  return searchParams.get('token');
}
