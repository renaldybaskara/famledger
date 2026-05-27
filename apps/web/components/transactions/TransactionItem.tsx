import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Transaction } from '../../src/lib/api'
import { formatCurrency, formatDateShort } from '../../src/lib/format'

interface TransactionItemProps {
  transaction: Transaction
  onPress?: () => void
  onLongPress?: () => void
  showDate?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  transfer: 'Transfer',
}

// Map icon name to simple emoji/symbol for native fallback
function CategoryDot({ color, icon }: { color: string; icon: string }) {
  return (
    <View
      className="w-10 h-10 rounded-xl items-center justify-center"
      style={{ backgroundColor: color ? `${color}20` : '#1A2B4A20' }}
    >
      <Text style={{ fontSize: 18 }}>{icon || '💰'}</Text>
    </View>
  )
}

export function TransactionItem({
  transaction,
  onPress,
  onLongPress,
  showDate = true,
}: TransactionItemProps) {
  const isIncome = transaction.type === 'income'
  const isTransfer = transaction.type === 'transfer'
  const amountColor = isIncome
    ? 'text-income'
    : isTransfer
    ? 'text-transfer'
    : 'text-expense'
  const amountPrefix = isIncome ? '+' : isTransfer ? '' : '-'

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 bg-white"
    >
      {/* Category icon */}
      <CategoryDot
        color={transaction.category?.color ?? '#1A2B4A'}
        icon={transaction.category?.icon ?? '💰'}
      />

      {/* Details */}
      <View className="flex-1 ml-3 min-w-0">
        <Text className="text-slate-800 font-medium text-sm" numberOfLines={1}>
          {transaction.merchant || transaction.category?.name || TYPE_LABELS[transaction.type]}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-slate-400 text-xs">
            {transaction.category?.name ?? TYPE_LABELS[transaction.type]}
          </Text>
          {showDate && transaction.date && (
            <>
              <Text className="text-slate-300 text-xs mx-1">·</Text>
              <Text className="text-slate-400 text-xs">{formatDateShort(transaction.date)}</Text>
            </>
          )}
        </View>
        {transaction.note ? (
          <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>

      {/* Amount */}
      <View className="ml-3 items-end">
        <Text className={`font-bold text-sm font-mono ${amountColor}`}>
          {amountPrefix}
          {formatCurrency(transaction.amount)}
        </Text>
        {transaction.account && (
          <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
            {transaction.account.name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

interface TransactionGroupProps {
  date: string
  transactions: Transaction[]
  onPressItem?: (t: Transaction) => void
}

export function TransactionGroup({ date, transactions, onPressItem }: TransactionGroupProps) {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <View className="mb-2">
      {/* Date header */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-slate-50">
        <Text className="text-slate-500 text-xs font-medium">{formatDateShort(date)}</Text>
        <View className="flex-row gap-3">
          {totalIncome > 0 && (
            <Text className="text-income text-xs font-mono">
              +{formatCurrency(totalIncome)}
            </Text>
          )}
          {totalExpense > 0 && (
            <Text className="text-expense text-xs font-mono">
              -{formatCurrency(totalExpense)}
            </Text>
          )}
        </View>
      </View>

      {/* Transactions */}
      <View className="bg-white">
        {transactions.map((t, idx) => (
          <View key={t.id}>
            <TransactionItem
              transaction={t}
              onPress={() => onPressItem?.(t)}
              showDate={false}
            />
            {idx < transactions.length - 1 && (
              <View className="h-px bg-slate-50 ml-17" />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
