import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const C = {
  cream: '#FAF7F2', surface: '#FFFFFF',
  primary: '#6B8E6B', heroEnd: '#41594F',
  fg1: '#2D2A26', fg2: '#55504A', fg3: '#8E887F',
  border: '#E0DBD2',
}

export default function PrivacyPolicyPage() {
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
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>Kebijakan Privasi</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: 'Nunito_500Medium' }}>
            Terakhir diperbarui: 1 Juli 2026
          </Text>
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          <Section title="1. Pendahuluan">
            FamLedger ("kami", "aplikasi") berkomitmen untuk melindungi privasi pengguna. Kebijakan privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda saat menggunakan aplikasi FamLedger.
          </Section>

          <Section title="2. Informasi yang Kami Kumpulkan">
            {`Kami mengumpulkan informasi berikut:\n\n• Informasi akun: nama, alamat email, dan foto profil (jika login dengan Google)\n• Data transaksi keuangan yang Anda masukkan secara manual atau diimpor dari email bank\n• Notifikasi email bank yang Anda izinkan untuk diakses melalui Gmail\n• Data penggunaan aplikasi untuk meningkatkan layanan`}
          </Section>

          <Section title="3. Cara Kami Menggunakan Informasi">
            {`Informasi yang dikumpulkan digunakan untuk:\n\n• Menyediakan layanan pencatatan keuangan pribadi dan keluarga\n• Mengimpor dan menganalisis transaksi dari notifikasi email bank\n• Mengkategorikan transaksi secara otomatis menggunakan AI\n• Mengirimkan notifikasi dan undangan workspace kepada anggota keluarga`}
          </Section>

          <Section title="4. Akses Gmail">
            {`Jika Anda menghubungkan akun Gmail, FamLedger hanya membaca email notifikasi dari bank dan e-wallet untuk mengimpor transaksi secara otomatis. Kami tidak membaca, menyimpan, atau berbagi konten email lainnya. Akses dapat dicabut kapan saja melalui pengaturan Google Account Anda.`}
          </Section>

          <Section title="5. Penyimpanan Data">
            {`Data Anda disimpan di server self-hosted yang Anda kontrol sendiri. FamLedger adalah aplikasi self-hosted, artinya data tidak dikirim ke server pihak ketiga selain layanan yang Anda aktifkan secara eksplisit (seperti OpenRouter AI atau Midtrans Payment).`}
          </Section>

          <Section title="6. Berbagi Data">
            {`Kami tidak menjual atau berbagi data pribadi Anda kepada pihak ketiga. Data hanya diproses oleh layanan berikut jika dikonfigurasi:\n\n• OpenRouter / OpenAI: untuk kategorisasi transaksi otomatis\n• Midtrans: untuk pemrosesan pembayaran langganan\n• Google OAuth: untuk autentikasi dan akses Gmail`}
          </Section>

          <Section title="7. Keamanan">
            {`Kami menerapkan langkah keamanan standar industri termasuk:\n\n• Enkripsi HTTPS untuk semua komunikasi\n• Hash bcrypt untuk password\n• Token JWT dengan rotasi otomatis\n• Token OAuth tersimpan terenkripsi di database`}
          </Section>

          <Section title="8. Hak Pengguna">
            {`Anda memiliki hak untuk:\n\n• Mengakses dan mengunduh data Anda\n• Menghapus akun dan semua data terkait\n• Mencabut akses Gmail kapan saja\n• Meminta penjelasan tentang penggunaan data Anda`}
          </Section>

          <Section title="9. Kontak">
            Jika Anda memiliki pertanyaan tentang kebijakan privasi ini, hubungi kami melalui email di renaldybaskara8@gmail.com
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
