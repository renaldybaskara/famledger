import React, { useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, Platform, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useCreateTransaction } from '../../src/hooks/useTransactions'
import { useCategories } from '../../src/hooks/useCategories'
import { useAccounts } from '../../src/hooks/useAccounts'
import { resolveIcon } from '../../src/lib/iconMap'
import { paymentSlipsApi, ParsedSlip, TransactionType, Category, Account } from '../../src/lib/api'
import { useTheme } from '../../src/lib/theme'

function formatAmountInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const slipSchema = z.object({
  type:       z.enum(['income', 'expense', 'transfer']),
  amount:     z.string().min(1, 'Jumlah wajib diisi')
               .refine((v) => !isNaN(Number(v.replace(/\./g, ''))) && Number(v.replace(/\./g, '')) > 0, { message: 'Jumlah tidak valid' }),
  categoryId: z.string().optional(),
  accountId:  z.string().min(1, 'Pilih rekening'),
  merchant:   z.string().optional(),
  note:       z.string().optional(),
  date:       z.string().min(1, 'Pilih tanggal'),
})

type SlipFormData = z.infer<typeof slipSchema>

type Step = 'pick' | 'loading' | 'review'

interface Props { visible: boolean; onClose: () => void }

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth > 600 : false
  )
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setIsDesktop(window.innerWidth > 600)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isDesktop
}

export function PaymentSlipScanModal({ visible, onClose }: Props) {
  const C = useTheme()
  const TYPE_OPTIONS: Array<{ value: TransactionType; label: string; color: string; soft: string }> = [
    { value: 'expense',  label: '↑ Keluar',   color: C.accent,   soft: C.accentSoft   },
    { value: 'income',   label: '↓ Masuk',    color: C.primary,  soft: C.primarySoft  },
    { value: 'transfer', label: '⇄ Transfer', color: (C as any).transfer ?? '#6E97AE', soft: (C as any).transferSoft ?? '#DEEAF1' },
  ]
  const { data: categories = [] } = useCategories()
  const { data: accounts   = [] } = useAccounts()
  const createMutation            = useCreateTransaction()
  const isDesktop = useIsDesktop()

  const [step, setStep]                   = useState<Step>('pick')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [parsed, setParsed]               = useState<ParsedSlip | null>(null)
  const [scanError, setScanError]         = useState('')
  const [serverError, setServerError]     = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const { control, handleSubmit, watch, reset, setValue, formState: { errors } } =
    useForm<SlipFormData>({
      resolver: zodResolver(slipSchema),
      defaultValues: {
        type: 'expense', amount: '', categoryId: '', accountId: '',
        merchant: '', note: '', date: format(new Date(), 'yyyy-MM-dd'),
      },
    })

  const selectedType = watch('type')
  const typeOpt      = TYPE_OPTIONS.find((t) => t.value === selectedType)!
  const filteredCats = (categories as Category[]).filter(
    (c) => c.type === selectedType || selectedType === 'transfer'
  )

  const handleClose = () => {
    reset()
    setStep('pick')
    setParsed(null)
    setScanError('')
    setServerError('')
    if (imagePreviewUrl) {
      if (Platform.OS === 'web') URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl(null)
    }
    onClose()
  }

  const uploadSlip = async (fd: FormData) => {
    setScanError('')
    setStep('loading')

    try {
      const { data } = await paymentSlipsApi.scan(fd)
      setParsed(data)

      // Pre-fill form
      if (data.amount > 0) setValue('amount', formatAmountInput(String(Math.round(data.amount))))
      if (data.merchant)   setValue('merchant', data.merchant)
      if (data.date)       setValue('date', data.date.split('T')[0])
      if (data.type === 'income' || data.type === 'expense') setValue('type', data.type)

      setStep('review')
    } catch (err: any) {
      setScanError(
        err?.response?.data?.message ||
        'Gagal memproses slip. Coba foto yang lebih jelas atau pencahayaan lebih baik.'
      )
      setStep('pick')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately (no server round-trip needed)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(URL.createObjectURL(file))

    const fd = new FormData()
    fd.append('file', file, file.name)
    await uploadSlip(fd)

    // Reset file inputs so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const pickNativeImage = async (source: 'camera' | 'gallery') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      setScanError(
        source === 'camera'
          ? 'Izin kamera ditolak. Aktifkan di Settings untuk memfoto slip.'
          : 'Izin galeri ditolak. Aktifkan di Settings untuk memilih foto.'
      )
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setImagePreviewUrl(asset.uri)

    const filename = asset.fileName || asset.uri.split('/').pop() || 'slip.jpg'
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeType = asset.mimeType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')

    const fd = new FormData()
    fd.append('file', { uri: asset.uri, name: filename, type: mimeType } as any)
    await uploadSlip(fd)
  }

  const onSubmit = (data: SlipFormData) => {
    setServerError('')
    const amount = parseFloat(data.amount.replace(/\./g, '').replace(',', '.'))
    createMutation.mutate(
      {
        type:       data.type,
        amount,
        categoryId: data.categoryId as string,
        accountId:  data.accountId,
        merchant:   data.merchant   || undefined,
        note:       data.note       || undefined,
        date:       data.date,
      },
      {
        onSuccess: handleClose,
        onError: (err: any) =>
          setServerError(err.response?.data?.message || 'Gagal menyimpan transaksi'),
      }
    )
  }

  // ── Step 1: image picker ─────────────────────────────────────
  const pickContent = (
    <View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: C.fg3, textAlign: 'center', fontFamily: 'Inter_500Medium', lineHeight: 20 }}>
        Upload foto struk atau bukti transfer untuk mengisi transaksi otomatis
      </Text>

      {scanError ? (
        <View style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12, width: '100%' }}>
          <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>
            {scanError}
          </Text>
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <>
          {/* Camera button — opens rear camera directly on mobile browsers */}
          <TouchableOpacity
            onPress={() => fileInputRef.current?.click()}
            style={{
              width: '100%', paddingVertical: 28, borderRadius: 18,
              borderWidth: 2, borderStyle: 'dashed' as any, borderColor: C.border,
              backgroundColor: C.creamSunken, alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 36 }}>📷</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
              Ambil Foto (Kamera)
            </Text>
          </TouchableOpacity>

          {/* Gallery / file button — normal file picker, no forced camera */}
          <TouchableOpacity
            onPress={() => galleryInputRef.current?.click()}
            style={{
              width: '100%', paddingVertical: 28, borderRadius: 18,
              borderWidth: 2, borderStyle: 'dashed' as any, borderColor: C.border,
              backgroundColor: C.creamSunken, alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 36 }}>🖼️</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
              Upload dari Galeri / File
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: C.fg4, fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
            JPEG, PNG, WebP, atau HEIC (iOS) — maks 10 MB
          </Text>

          {/* Camera input — capture forces rear camera on mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {/* Gallery input — no capture, shows normal file/gallery picker */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </>
      ) : (
        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={() => pickNativeImage('camera')}
            style={{
              width: '100%', paddingVertical: 28, borderRadius: 18,
              borderWidth: 2, borderStyle: 'dashed' as any, borderColor: C.border,
              backgroundColor: C.creamSunken, alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 36 }}>📷</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
              Ambil Foto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => pickNativeImage('gallery')}
            style={{
              width: '100%', paddingVertical: 28, borderRadius: 18,
              borderWidth: 2, borderStyle: 'dashed' as any, borderColor: C.border,
              backgroundColor: C.creamSunken, alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 36 }}>🖼️</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold' }}>
              Pilih dari Galeri
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: C.fg4, fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
            JPEG, PNG, atau WebP — maks 10 MB
          </Text>
        </View>
      )}
    </View>
  )

  // ── Step 2: processing ───────────────────────────────────────
  const loadingContent = (
    <View style={{ padding: 40, alignItems: 'center', gap: 20 }}>
      {imagePreviewUrl && (
        <Image
          source={{ uri: imagePreviewUrl }}
          resizeMode="cover"
          style={{ width: 120, height: 120, borderRadius: 16, borderWidth: 1.5, borderColor: C.border }}
        />
      )}
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.fg1, fontFamily: 'Inter_700Bold' }}>
        Memproses slip...
      </Text>
      <Text style={{ fontSize: 12, color: C.fg4, textAlign: 'center', fontFamily: 'Inter_500Medium' }}>
        Mungkin butuh hingga 30 detik
      </Text>
    </View>
  )

  // ── Step 3: review & edit ─────────────────────────────────────
  const reviewContent = (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Platform.OS === 'web' ? '75vh' as any : '85%' }}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 24 : 0 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ padding: 20, gap: 16 }}>

        {/* Type toggle — FIRST so it's immediately visible */}
        <Controller
          control={control} name="type"
          render={({ field: { value, onChange } }) => (
            <View style={{ flexDirection: 'row', backgroundColor: C.creamSunken, borderRadius: 14, padding: 4 }}>
              {TYPE_OPTIONS.map((opt) => {
                const active = value === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', borderRadius: 11, backgroundColor: active ? opt.color : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#fff' : C.fg3, fontFamily: 'Inter_800ExtraBold' }} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        />

        {/* Amount — SECOND, right below tabs */}
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={labelStyle}>Jumlah</Text>
          <Controller
            control={control} name="amount"
            render={({ field: { value, onChange } }) => (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: typeOpt.color, fontFamily: 'Inter_900Black' }}>Rp</Text>
                <TextInput
                  style={{ fontSize: 36, fontWeight: '900', color: typeOpt.color, fontFamily: 'Inter_900Black', minWidth: 80, maxWidth: 220, textAlign: 'center', fontVariant: ['tabular-nums'] as any, borderBottomWidth: 2, borderColor: errors.amount ? C.danger : typeOpt.color, paddingBottom: 4 }}
                  placeholder="0"
                  placeholderTextColor={typeOpt.color + '55'}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={(t) => onChange(formatAmountInput(t))}
                />
              </View>
            )}
          />
          {errors.amount && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4, fontFamily: 'Inter_600SemiBold' }}>{errors.amount.message}</Text>}
        </View>

        <View style={{ height: 1, backgroundColor: C.divider }} />

        {/* Slip meta — compact row: thumbnail + bank badge + accuracy warning */}
        {(imagePreviewUrl || parsed?.bank || (parsed && parsed.confidence < 0.7)) ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {imagePreviewUrl && (
              <Image
                source={{ uri: imagePreviewUrl }}
                resizeMode="cover"
                style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, flexShrink: 0 }}
              />
            )}
            <View style={{ flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {parsed?.bank ? (
                <View style={{ backgroundColor: C.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.heroEnd, fontFamily: 'Inter_700Bold' }}>
                    🏦 {parsed.bank}
                  </Text>
                </View>
              ) : null}
              {parsed && parsed.confidence < 0.7 ? (
                <View style={{ backgroundColor: C.warningSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.warning, fontFamily: 'Inter_700Bold' }}>
                    ⚠ Akurasi rendah — periksa kembali
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Category */}
        <View>
          <Text style={labelStyle}>Kategori <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
          <Controller
            control={control} name="categoryId"
            render={({ field: { value, onChange } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => onChange('')}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: !value ? C.primary : C.creamSunken, borderColor: !value ? C.primary : C.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: !value ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>Tanpa Kategori</Text>
                  </TouchableOpacity>
                  {filteredCats.map((cat: Category) => {
                    const active = value === cat.id
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => onChange(cat.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: active ? cat.color : C.creamSunken, borderColor: active ? cat.color : C.border, gap: 6 }}
                      >
                        <Text style={{ fontSize: 16 }}>{resolveIcon(cat.icon)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>{cat.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            )}
          />
        </View>

        {/* Account */}
        <View>
          <Text style={labelStyle}>Rekening</Text>
          <Controller
            control={control} name="accountId"
            render={({ field: { value, onChange } }) => (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(accounts as Account[]).length === 0 ? (
                  <Text style={{ fontSize: 13, color: C.fg4, fontFamily: 'Inter_500Medium', paddingVertical: 8 }}>Buat rekening dulu di Settings</Text>
                ) : (accounts as Account[]).map((acc: Account) => {
                  const active = value === acc.id
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => onChange(acc.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 2, backgroundColor: active ? C.primary : C.creamSunken, borderColor: active ? C.primary : C.border, gap: 6 }}
                    >
                      <Text style={{ fontSize: 16 }}>{(acc as any).icon || '💳'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : C.fg2, fontFamily: 'Inter_700Bold' }}>{acc.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          />
          {errors.accountId && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4, fontFamily: 'Inter_600SemiBold' }}>{errors.accountId.message}</Text>}
        </View>

        {/* Merchant */}
        <View>
          <Text style={labelStyle}>Merchant / Toko <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
          <Controller
            control={control} name="merchant"
            render={({ field: { value, onChange } }) => (
              <TextInput style={inputStyle} placeholder="Nama merchant..." placeholderTextColor={C.fg4} value={value} onChangeText={onChange} />
            )}
          />
        </View>

        {/* Date */}
        <View>
          <Text style={labelStyle}>Tanggal</Text>
          <Controller
            control={control} name="date"
            render={({ field: { value, onChange } }) =>
              Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={value}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => onChange(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${errors.date ? C.danger : C.border}`, borderRadius: 12, fontSize: 15, color: C.fg1, backgroundColor: C.creamSunken, fontFamily: 'Inter, system-ui', outline: 'none' }}
                />
              ) : (
                <TextInput style={{ ...inputStyle, borderColor: errors.date ? C.danger : C.border }} placeholder="YYYY-MM-DD" placeholderTextColor={C.fg4} value={value} onChangeText={onChange} />
              )
            }
          />
        </View>

        {/* Note */}
        <View>
          <Text style={labelStyle}>Catatan <Text style={{ color: C.fg4, fontWeight: '500' }}>(opsional)</Text></Text>
          <Controller
            control={control} name="note"
            render={({ field: { value, onChange } }) => (
              <TextInput style={{ ...inputStyle, minHeight: 64, textAlignVertical: 'top' }} placeholder="Tambah catatan..." placeholderTextColor={C.fg4} multiline numberOfLines={2} value={value} onChangeText={onChange} />
            )}
          />
        </View>

        {serverError ? (
          <View style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: C.danger, fontSize: 13, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>{serverError}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => { setStep('pick'); setScanError('') }}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.creamSunken, borderWidth: 1.5, borderColor: C.border }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.fg2, fontFamily: 'Inter_700Bold' }}>📷 Scan Ulang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: createMutation.isPending ? C.primary + '99' : C.primary }}
          >
            {createMutation.isPending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'Inter_900Black' }}>Simpan Transaksi</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  )

  const modalTitles: Record<Step, string> = {
    pick:    'Scan Slip Pembayaran',
    loading: 'Memproses...',
    review:  'Konfirmasi Transaksi',
  }

  const cardStyle = isDesktop
    ? { backgroundColor: C.surface, borderRadius: 24 }
    : { backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }

  const content = (
    <View style={cardStyle}>
      {/* Handle bar — only on mobile bottom sheet */}
      {!isDesktop && (
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
        </View>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
      }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.fg1, fontFamily: 'Inter_800ExtraBold' }}>
          {modalTitles[step]}
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: C.creamSunken,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: C.fg2, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 1, backgroundColor: C.divider, marginHorizontal: 20, marginTop: 8 }} />

      {step === 'pick'    && pickContent}
      {step === 'loading' && loadingContent}
      {step === 'review'  && reviewContent}
    </View>
  )

  if (Platform.OS === 'web') {
    if (!visible) return null

    if (isDesktop) {
      return (
        <View style={{ position: 'fixed' as any, inset: 0, zIndex: 1000, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={handleClose} activeOpacity={1} />
          <View style={{ width: '100%', maxWidth: 480, zIndex: 1 }}>
            {content}
          </View>
        </View>
      )
    }

    return (
      <View style={{ position: 'fixed' as any, inset: 0, zIndex: 1000, backgroundColor: 'rgba(45,42,38,0.5)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute' as any, inset: 0 }} onPress={handleClose} activeOpacity={1} />
        <View style={{
          width: '100%', maxWidth: 520, zIndex: 1,
          maxHeight: '92dvh' as any,
          display: 'flex' as any, flexDirection: 'column' as any,
        }}>
          {content}
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(45,42,38,0.5)' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClose} activeOpacity={1} />
        <View style={{ maxHeight: '90%' }}>{content}</View>
      </View>
    </Modal>
  )
}

const labelStyle = { fontSize: 12, fontWeight: '700' as const, color: '#8E887F', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8, fontFamily: 'Inter_700Bold' }
const inputStyle = { backgroundColor: '#F4EEE3', borderWidth: 1.5, borderColor: '#E0DBD2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#2D2A26', fontFamily: 'Inter_600SemiBold' }
