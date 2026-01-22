import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useEffect, useCallback } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

export function useRiddle() {
  const { data: riddle, refetch: refetchRiddle } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'riddle' })
  const { data: isActive, refetch: refetchActive } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'isActive' })
  const { data: winner, refetch: refetchWinner } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'winner' })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const refetchAll = useCallback(async () => {
    const [r, a, w] = await Promise.all([refetchRiddle(), refetchActive(), refetchWinner()])
    return { riddle: r.data, isActive: a.data, winner: w.data }
  }, [refetchRiddle, refetchActive, refetchWinner])

  const submitAnswer = (answer) => {
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'submitAnswer', args: [answer.toUpperCase()] })
  }

  return { riddle, isActive, winner, submitAnswer, isChecking: isPending || isConfirming, isSuccess, isError, hash, refetchAll }
}