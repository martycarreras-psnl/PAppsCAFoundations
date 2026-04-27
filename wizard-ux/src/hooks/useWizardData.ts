import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useWizardState() {
  return useQuery({
    queryKey: ['state'],
    queryFn: () => api.state(),
    refetchInterval: 5_000, // pick up CLI changes
  });
}

export function useSystem() {
  return useQuery({
    queryKey: ['system'],
    queryFn: () => api.system(),
    staleTime: 30_000,
  });
}

export function useSteps() {
  return useQuery({
    queryKey: ['steps'],
    queryFn: () => api.steps(),
    refetchInterval: 5_000,
  });
}

export function useStepQuestions(n: number | null) {
  return useQuery({
    queryKey: ['questions', n],
    queryFn: () => api.questions(n!),
    enabled: n != null,
  });
}
