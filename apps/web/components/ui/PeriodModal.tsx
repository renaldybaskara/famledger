import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, useWindowDimensions } from 'react-native'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { id } from 'date-fns/locale'
import { useTheme } from '../../src/lib/theme'

export type Preset = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'this_year' | 'payday' | 'custom'

export function getPresetRange(
  preset: Preset,
  custom?: { start: string; end: string },
  paydayDate = 25,
): { startDate: string; endDate: string; label: string } {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate:   format(endOfMonth(now), 'yyyy-MM-dd'),
        label:     format(now, 'MMMM yyyy', { locale: id }),
      }
    case 'last_month': {
      const last = subMonths(now, 1)
      return {
        startDate: format(startOfMonth(last), 'yyyy-MM-dd'),
        endDate:   format(endOfMonth(last), 'yyyy-MM-dd'),
        label:     format(last, 'MMMM yyyy', { locale: id }),
      }
    }
    case 'last_3':
      return {
        startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
        endDate:   format(endOfMonth(now), 'yyyy-MM-dd'),
        label:     '3 Bulan Terakhir',
      }
    case 'last_6':
      return {
        startDate: format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'),
        endDate:   format(endOfMonth(now), 'yyyy-MM-dd'),
        label:     '6 Bulan Terakhir',
      }
    case 'this_year':
      return {
        startDate: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
        endDate:   format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd'),
        label:     `Tahun ${now.getFullYear()}`,
      }
    case 'payday': {
      const day = paydayDate
      const todayDay = now.getDate()
      let ps: Date
      if (todayDay >= day) {
        ps = new Date(now.getFullYear(), now.getMonth(), day)
      } else {
        const prev = subMonths(now, 1)
        ps = new Date(prev.getFullYear(), prev.getMonth(), day)
      }
      // Cap end at today so the filter shows "last payday → today" (running total),
      // not a future date. This ensures today's transactions are always within range.
      const pe = now < new Date(ps.getFullYear(), ps.getMonth() + 1, day - 1) ? now : new Date(ps.getFullYear(), ps.getMonth() + 1, day - 1)
      return {
        startDate: format(ps, 'yyyy-MM-dd'),
        endDate:   format(pe, 'yyyy-MM-dd'),
        label: `Gajian ${day} (${format(ps, 'd MMM', { locale: id })} – ${format(pe, 'd MMM', { locale: id })})`,
      }
    }
    case 'custom':
      return {
        startDate: custom?.start ?? format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate:   custom?.end   ?? format(endOfMonth(now), 'yyyy-MM-dd'),
        label: custom
          ? `${format(new Date(custom.start), 'd MMM', { locale: id })} – ${format(new Date(custom.end), 'd MMM yyyy', { locale: id })}`
          : 'Custom',
      }
  }
}

interface PeriodModalProps {
  visible: boolean
  current: Preset
  paydayDate: number
  onSelect: (p: Preset, custom?: { start: string; end: string }, payday?: number) => void
  onClose: () => void
}

export function PeriodModal({ visible, current, paydayDate, onSelect, onClose }: PeriodModalProps) {
  const C = useTheme()
  const now = new Date()
  const { height: screenHeight } = useWindowDimensions()
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd]     = useState(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [showCustom, setShowCustom]   = useState(false)
  const [showPayday, setShowPayday]   = useState(false)
  const [paydayInput, setPaydayInput] = useState(String(paydayDate))

  // Leave at least 80px at the top so the modal never covers the full screen.
  // On small screens (< 600px) use 90% of screen height; on larger screens cap at 600px.
  const maxModalHeight = Math.min(screenHeight * 0.90, 600)

  const presets: { key: Preset; label: string }[] = [
    { key: 'this_month', label: 'Bulan Ini'        },
    { key: 'last_month', label: 'Bulan Lalu'        },
    { key: 'last_3',     label: '3 Bulan Terakhir'  },
    { key: 'last_6',     label: '6 Bulan Terakhir'  },
    { key: 'this_year',  label: 'Tahun Ini'          },
    { key: 'payday',     label: 'Periode Gajian'     },
    { key: 'custom',     label: 'Pilih Tanggal'      },
  ]

  const modalContent = (
    <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' as any, flex: 1 as any }}>
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
        <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: C.fg1, fontFamily: 'Inter_900Black', letterSpacing: -0.3, paddingTop: 8 }}>
          Pilih Periode
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, minHeight: 0 } as any}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={true}
      >
        <View>
          {presets.map((p) => {
            const active = current === p.key
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => {
                  if (p.key === 'custom') { setShowCustom(true); setShowPayday(false) }
                  else if (p.key === 'payday') { setShowPayday(true); setShowCustom(false) }
                  else { onSelect(p.key); onClose() }
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, paddingHorizontal: 16,
                  marginBottom: 6, borderRadius: 14,
                  backgroundColor: active ? C.primarySoft : C.creamSunken,
                }}
              >
                <Text style={{
                  fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold',
                  color: active ? C.heroEnd : C.fg1,
                }}>
                  {p.label}
                </Text>
                {active && (
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.primary }} />
                )}
              </TouchableOpacity>
            )
          })}

          {showPayday && (
            <View style={{
              backgroundColor: '#FBEFD2', borderRadius: 14,
              padding: 16, marginTop: 4, marginBottom: 8,
              borderWidth: 1, borderColor: '#E3B25A',
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#8C6B1F', marginBottom: 8, fontFamily: 'Inter_800ExtraBold' }}>
                💰 Tanggal Gajian
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.fg2 }}>Tanggal:</Text>
                {typeof window !== 'undefined' ? (
                  <input
                    type="number" min={1} max={28}
                    value={paydayInput}
                    onChange={(e) => setPaydayInput(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 12px', border: '1px solid #E3B25A',
                      borderRadius: 10, fontSize: 14, color: C.fg1, backgroundColor: '#fff',
                      fontFamily: 'Inter, system-ui',
                    }}
                  />
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => {
                  const day = Math.min(28, Math.max(1, parseInt(paydayInput) || 25))
                  onSelect('payday', undefined, day)
                  onClose()
                }}
                style={{ backgroundColor: C.mustard, borderRadius: 12, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontFamily: 'Inter_800ExtraBold' }}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          )}

          {showCustom && (
            <View style={{
              backgroundColor: C.creamSunken, borderRadius: 14,
              padding: 16, marginTop: 4, marginBottom: 8,
              borderWidth: 1, borderColor: C.border,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.fg2, marginBottom: 12, fontFamily: 'Inter_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Rentang Tanggal
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Dari', val: customStart, set: setCustomStart },
                  { label: 'Sampai', val: customEnd, set: setCustomEnd },
                ].map(({ label, val, set }) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: C.fg2, marginBottom: 6 }}>{label}</Text>
                    {typeof window !== 'undefined' ? (
                      <input
                        type="date" value={val}
                        onChange={(e) => set(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px',
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          fontSize: 13, color: C.fg1, backgroundColor: '#fff',
                          fontFamily: 'Inter, system-ui',
                        }}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (customStart && customEnd) { onSelect('custom', { start: customStart, end: customEnd }); onClose() }
                }}
                style={{ backgroundColor: C.primary, borderRadius: 12, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontFamily: 'Inter_800ExtraBold' }}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 8 }} />
        </View>
      </ScrollView>
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null
    return (
      <View style={{ position: 'fixed' as any, inset: 0, zIndex: 100, backgroundColor: 'rgba(45,42,38,0.45)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
        <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={onClose} activeOpacity={1} />
        <View style={{
          width: '100%', maxWidth: 520, zIndex: 1,
          maxHeight: '75dvh' as any,
          display: 'flex' as any, flexDirection: 'column' as any,
        }}>
          {modalContent}
        </View>
      </View>
    )
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(45,42,38,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>{modalContent}</TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
