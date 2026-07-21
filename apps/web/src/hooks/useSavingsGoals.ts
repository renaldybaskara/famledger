import { useState, useEffect, useCallback } from 'react'
import {
  savingsGoalsApi,
  SavingsGoal,
  SavingsGoalSummary,
  SavingsGoalContribution,
  SavingsGoalSource,
  CreateGoalInput,
  UpdateGoalInput,
  AddSourceInput,
  AddContributionInput,
} from '../lib/savingsGoals'

// Hook for listing goals
export function useSavingsGoals(status?: string, workspaceId?: string) {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await savingsGoalsApi.list({ status, workspaceId })
      setGoals(data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [status, workspaceId])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  return { goals, loading, error, refetch: fetchGoals }
}

// Hook for a single goal detail
export function useSavingsGoalDetail(goalId: string) {
  const [goal, setGoal] = useState<SavingsGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoal = useCallback(async () => {
    if (!goalId) return
    try {
      setLoading(true)
      const { data } = await savingsGoalsApi.get(goalId)
      setGoal(data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load goal')
    } finally {
      setLoading(false)
    }
  }, [goalId])

  useEffect(() => {
    fetchGoal()
  }, [fetchGoal])

  return { goal, loading, error, refetch: fetchGoal }
}

// Hook for dashboard summary (all data from backend)
export function useSavingsGoalSummary() {
  const [summary, setSummary] = useState<SavingsGoalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await savingsGoalsApi.getSummary()
      setSummary(data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  return { summary, loading, error, refetch: fetchSummary }
}

// Hook for contributions list
export function useSavingsGoalContributions(goalId: string, type?: string) {
  const [contributions, setContributions] = useState<SavingsGoalContribution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchContributions = useCallback(async () => {
    if (!goalId) return
    try {
      setLoading(true)
      const { data } = await savingsGoalsApi.listContributions(goalId, { type, page, limit: 20 })
      setContributions(data.data)
      setTotal(data.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [goalId, type, page])

  useEffect(() => {
    fetchContributions()
  }, [fetchContributions])

  return { contributions, total, page, setPage, loading, refetch: fetchContributions }
}

// Mutation hooks (actions)
export function useSavingsGoalActions() {
  const [loading, setLoading] = useState(false)

  const createGoal = async (input: CreateGoalInput) => {
    setLoading(true)
    try {
      const { data } = await savingsGoalsApi.create(input)
      return data
    } finally {
      setLoading(false)
    }
  }

  const updateGoal = async (id: string, input: UpdateGoalInput) => {
    setLoading(true)
    try {
      const { data } = await savingsGoalsApi.update(id, input)
      return data
    } finally {
      setLoading(false)
    }
  }

  const deleteGoal = async (id: string) => {
    setLoading(true)
    try {
      await savingsGoalsApi.delete(id)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setLoading(true)
    try {
      await savingsGoalsApi.updateStatus(id, status)
    } finally {
      setLoading(false)
    }
  }

  const addSource = async (goalId: string, input: AddSourceInput) => {
    setLoading(true)
    try {
      const { data } = await savingsGoalsApi.addSource(goalId, input)
      return data
    } finally {
      setLoading(false)
    }
  }

  const deleteSource = async (goalId: string, sourceId: string) => {
    setLoading(true)
    try {
      await savingsGoalsApi.deleteSource(goalId, sourceId)
    } finally {
      setLoading(false)
    }
  }

  const addContribution = async (goalId: string, input: AddContributionInput) => {
    setLoading(true)
    try {
      const { data } = await savingsGoalsApi.addContribution(goalId, input)
      return data
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    updateStatus,
    addSource,
    deleteSource,
    addContribution,
  }
}
