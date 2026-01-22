import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useEffect } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

export function useRiddle() {
  const { data: riddle, refetch: refetchRiddle } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'riddle',
  })

  const { data: isActive, refetch: refetchActive } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isActive',
  })

  const { data: winner, refetch: refetchWinner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'winner',
  })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const isChecking = isPending || isConfirming

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        refetchRiddle()
        refetchActive()
        refetchWinner()
      }, 1500)
    }
  }, [isSuccess])

  const submitAnswer = (answer) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'submitAnswer',
      args: [answer.toUpperCase()],
    })
  }

  const refetchAll = async () => {
    const [r, a, w] = await Promise.all([
      refetchRiddle(),
      refetchActive(),
      refetchWinner()
    ])
    return { riddle: r.data, isActive: a.data, winner: w.data }
  }

  return {
    riddle,
    isActive,
    winner,
    submitAnswer,
    isChecking,
    isSuccess,
    refetchAll
  }
}
