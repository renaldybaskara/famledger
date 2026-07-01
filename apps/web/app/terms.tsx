import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const C = {
  cream: '#FAF7F2', surface: '#FFFFFF',
  primary: '#6B8E6B', heroEnd: '#41594F',
  fg1: '#2D2A26', fg2: '#55504A', fg3: '#8E887F',
  border: '#E0DBD2',
}

export default function TermsPage() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: C.heroEnd, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.8)', lineHeight: 26 }}>‹</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Nunito_600SemiBold', marginLeft: 2 }}>Kembali</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>Syarat & Ketentuan</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: 'Nunito_500Medium' }}>
            Terakhir diperbarui: 1 Juli 2026
          </Text>
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          <Section title="1. Penerimaan Syarat">
            Dengan menggunakan aplikasi Budgetin, Anda menyetujui syarat dan ketentuan ini. Jika Anda tidak setuju, harap hentikan penggunaan aplikasi.
          </Section>

          <Section title="2. Deskripsi Layanan">
            {`Budgetin adalah aplikasi manajemen keuangan keluarga yang memungkinkan pengguna untuk:\n\n• Mencatat dan melacak transaksi keuangan pribadi dan keluarga\n• Mengimpor transaksi otomatis dari notifikasi email bank\n• Membuat anggaran dan memantau pengeluaran\n• Berbagi data keuangan dengan anggota keluarga dalam workspace`}
          </Section>

          <Section title="3. Akun Pengguna">
            {`• Anda bertanggung jawab menjaga keamanan kredensial akun Anda\n• Satu akun hanya boleh digunakan oleh satu individu\n• Anda wajib memberikan informasi yang akurat saat mendaftar\n• Kami berhak menangguhkan akun yang melanggar ketentuan ini`}
          </Section>

          <Section title="4. Penggunaan yang Diizinkan">
            {`Anda boleh menggunakan Budgetin untuk:\n\n• Pencatatan keuangan pribadi dan keluarga\n• Berbagi laporan keuangan dengan anggota keluarga atau pasangan\n• Analisis pengeluaran dan perencanaan anggaran`}
          </Section>

          <Section title="5. Penggunaan yang Dilarang">
            {`Anda dilarang:\n\n• Menggunakan aplikasi untuk tujuan ilegal atau penipuan\n• Mencoba meretas atau mengganggu keamanan sistem\n• Berbagi akses akun dengan pihak yang tidak berwenang\n• Menggunakan data orang lain tanpa izin`}
          </Section>

          <Section title="6. Langganan dan Pembayaran">
            {`• Budgetin menawarkan paket gratis dengan fitur dasar dan paket Pro dengan fitur lengkap\n• Paket Pro tersedia dengan langganan bulanan, tahunan, atau seumur hidup\n• Pembayaran diproses melalui Midtrans (web) atau App Store/Play Store (mobile)\n• Langganan dapat dibatalkan kapan saja; akses Pro berlaku hingga akhir periode yang dibayar`}
          </Section>

          <Section title="7. Integrasi Pihak Ketiga">
            {`Budgetin terintegrasi dengan layanan pihak ketiga berikut:\n\n• Google OAuth & Gmail API: untuk login dan import transaksi email\n• Midtrans: untuk pemrosesan pembayaran\n• OpenRouter / OpenAI: untuk kategorisasi otomatis berbasis AI\n\nPenggunaan layanan ini tunduk pada syarat dan ketentuan masing-masing penyedia.`}
          </Section>

          <Section title="8. Batasan Tanggung Jawab">
            {`Budgetin tidak bertanggung jawab atas:\n\n• Kesalahan atau ketidakakuratan data transaksi yang diimpor dari email\n• Kerugian finansial yang timbul dari keputusan berdasarkan data di aplikasi\n• Gangguan layanan akibat pemeliharaan atau force majeure\n\nAplikasi ini adalah alat bantu pencatatan, bukan penasihat keuangan profesional.`}
          </Section>

          <Section title="9. Perubahan Syarat">
            Kami dapat memperbarui syarat ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui email atau notifikasi dalam aplikasi. Penggunaan berkelanjutan setelah perubahan berarti penerimaan syarat yang diperbarui.
          </Section>

          <Section title="10. Hukum yang Berlaku">
            Syarat dan ketentuan ini diatur oleh hukum Republik Indonesia. Sengketa diselesaikan melalui musyawarah atau pengadilan yang berwenang di Indonesia.
          </Section>

          <Section title="11. Kontak">
            Pertanyaan tentang syarat ini dapat dikirimkan ke renaldybaskara8@gmail.com
          </Section>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: string | React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.heroEnd, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: C.fg2, lineHeight: 20, fontFamily: 'Nunito_500Medium' }}>
        {children}
      </Text>
    </View>
  )
}
