import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Transaction } from '../../src/lib/api'
import { formatCurrency, formatDateShort } from '../../src/lib/format'
import { resolveIcon } from '../../src/lib/iconMap'
import { useTheme } from '../../src/lib/theme'

interface TransactionItemProps {
  transaction: Transaction
  onPress?: () => void
  onLongPress?: () => void
  showDate?: boolean
  memberName?: string
}

const TYPE_LABELS: Record<string, string> = {
  income:   'Pemasukan',
  expense:  'Pengeluaran',
  transfer: 'Transfer',
}

function CategoryBubble({ color, icon }: { color: string; icon: string }) {
  const bg = color ? color + '22' : '#6B8E6B22'
  return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icon || '💰'}</Text>
    </View>
  )
}

export function TransactionItem({ transaction, onPress, onLongPress, showDate = true, memberName }: TransactionItemProps) {
  const C = useTheme()
  const isIncome   = transaction.type === 'income'
  const isTransfer = transaction.type === 'transfer'
  const amountColor = isIncome ? C.income : isTransfer ? C.transfer : C.expense
  const amountPrefix = isIncome ? '+' : isTransfer ? '' : '−'

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isIncome ? C.incomeBg : isTransfer ? C.transferBg : C.expenseBg }}
    >
      <CategoryBubble
        color={transaction.category?.color ?? '#6B8E6B'}
        icon={resolveIcon(transaction.category?.icon ?? '', '💰')}
      />

      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg1, fontFamily: 'Nunito_700Bold' }} numberOfLines={1}>
          {transaction.merchant || transaction.category?.name || TYPE_LABELS[transaction.type]}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '500', color: C.fg3, fontFamily: 'Nunito_500Medium' }}>
            {transaction.category?.name ?? TYPE_LABELS[transaction.type]}
          </Text>
          {showDate && transaction.date && (
            <>
              <Text style={{ fontSize: 12, color: C.fg4 }}>·</Text>
              <Text style={{ fontSize: 12, color: C.fg4, fontFamily: 'Nunito_500Medium' }}>
                {formatDateShort(transaction.date)}
              </Text>
            </>
          )}
        </View>
        {(transaction as any).note ? (
          <Text style={{ fontSize: 12, color: C.fg4, marginTop: 1, fontFamily: 'Nunito_500Medium' }} numberOfLines={1}>
            {(transaction as any).note}
          </Text>
        ) : null}
        {memberName ? (
          <View style={{ flexDirection: 'row', marginTop: 3 }}>
            <View style={{ backgroundColor: '#DEE8D7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 11, color: '#41594F', fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>
                {memberName}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: amountColor, fontFamily: 'Nunito_800ExtraBold', fontVariant: ['tabular-nums'] as any }}>
          {amountPrefix}{formatCurrency(transaction.amount)}
        </Text>
        {transaction.account && (
          <Text style={{ fontSize: 11, color: C.fg4, marginTop: 2, fontFamily: 'Nunito_500Medium' }} numberOfLines={1}>
            {transaction.account.name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// TransactionGroup kept for potential reuse
export function TransactionGroup({ date, transactions, onPressItem }: {
  date: string; transactions: Transaction[]; onPressItem?: (t: Transaction) => void
}) {
  const C = useTheme()
  const totalIn  = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalOut = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingVertical: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.fg3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Nunito_800ExtraBold' }}>
          {formatDateShort(date)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {totalIn  > 0 && <Text style={{ fontSize: 12, fontWeight: '800', color: C.income,  fontFamily: 'Nunito_800ExtraBold' }}>+{fmt(totalIn)}</Text>}
          {totalOut > 0 && <Text style={{ fontSize: 12, fontWeight: '800', color: C.expense, fontFamily: 'Nunito_800ExtraBold' }}>−{fmt(totalOut)}</Text>}
        </View>
      </View>
      <View style={{ marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden' }}>
        {transactions.map((t, idx) => (
          <View key={t.id}>
            <TransactionItem transaction={t} showDate={false} onPress={() => onPressItem?.(t)} />
            {idx < transactions.length - 1 && <View style={{ height: 1, backgroundColor: C.divider, marginLeft: 70 }} />}
          </View>
        ))}
      </View>
    </View>
  )
}
