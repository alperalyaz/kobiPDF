# kobiPDF Android planı (Capacitor, aynı repo)

Durum: Adım 0 ve Adım 1 tamamlandı (24.11.2026, `bekleyen/android-adim1` dalı). Sıradaki: Adım 2 (telefon kabuğu).
Plan eleştirisinden geçti; bulgular aşağıya işlendi.

## Derleme (Windows, USB ile bağlı telefon)
    $env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"    # JDK 21; Android Studio'nun Java 25'i Gradle 8.14 ile çalışmaz
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
    npm run android:run        # tür denetimi + pdf.js dosyaları + `electron-vite build --mode android` + cap sync + kur/aç
Yalnız derlemek: `npm run android:sync`, sonra `android\gradlew.bat assembleDebug`. Xiaomi'de "USB ile yükle" açık olmalı;
her kurulumda telefonda onay ister.

## Kapsam (v1)
Var: PDF aç (dosya seçici ve "Birlikte aç / Paylaş"), görüntüle (kaydırma, iki parmakla yakınlaştırma),
Metni Düzenle (dokun-düzelt, eski yazı MuPDF ile gerçekten silinir), İmza / Kaşe (kayıtlı liste, yerleştir,
taşı, boyutlandır), kopya olarak kaydet ve Paylaş.
Yok: vurgulama, kalem, sayfa işlemleri, yazdırma, sekmeler, varsayılan uygulama.

## Adım 0 - Deneme (karar noktası, önce bu)
En büyük belirsizlik MuPDF'in (WebAssembly, yaklaşık 10 MB) telefondaki WebView içinde çalışıp çalışmadığı ve bellek.
- Ayrı bir deneme dalında boş bir Capacitor uygulaması: pdf.js ile aç, `eraseText` ile bir yazıyı sil, pdf-lib ile kaydet.
- Derleme ve deneme YEREL oturumda yapılır: kullanıcının Windows bilgisayarı, USB ile bağlı Android telefon
  (`npx cap run android`, hata kayıtları `adb logcat`). Bulut oturumu Android derleyemez; kodu hazırlayıp dala koyar.
- Ölçülecekler: 1 MB, 10 MB ve 50 MB PDF ile çalışıyor mu, ne kadar sürüyor, çöküyor mu; en düşük Android / WebView sürümü;
  Capacitor köprüsünün CSP'den ne istediği.
- Sonuç kötüyse: kapsam "yalnız imza / kaşe" (MuPDF'siz, pdf-lib ile) olur ya da Android iptal edilir.

**Sonuç (24.11.2026, Redmi 12, Android 15, 8 GB, WebView 149): OLUMLU, kapsam aynen kalır.**
1 MB, 10,8 MB ve 53,4 MB gerçek PDF'lerde MuPDF ile silme ve pdf-lib ile kaydetme çalıştı; çökme ve CSP engeli olmadı.
MuPDF silme en fazla 4,9 sn. Tek sorun kaydetme süresi: 53 MB'da pdf-lib `save()` 23 sn, 10 MB'da 2,9 sn.
Bundan çıkan iş: Adım 2'de kaydederken ilerleme göstergesi; büyük dosyada kaydetmeyi hızlandırmak için
`save({ useObjectStreams: false })` ya da kaydetmeyi MuPDF'e bırakmak denenmeli.
Henüz denenmeyen: "Kaydet ve paylaş", Android 7–9 gibi eski cihazlar, 4 GB ve altı RAM. Ayrıntı: `deneme/android/README.md`.

## Adım 1 - Ortak kod: tek arayüz, Android için `window.api` taklidi
- İkinci bir giriş (ayrı mobil uygulama, ikinci Vite ayarı) YOK. Mevcut renderer kullanılır; Capacitor `webDir` onun çıktısıdır.
- Android'de `window.api`, `KobiPdfApi` arayüzünü Capacitor ile uygulayan bir nesne olur (shim). window.api çağıran
  10 dosya değişmez. Masaüstüne özgü olanlar (yazdırma, varsayılan uygulama, kapatma koruması, klasör seçme) Android'de
  boş döner, düğmeleri gizlenir.
- Dosya yolu anlamı: Android'de kalıcı yol yok (content:// adresi, geçici izin). Açılan belgenin `path` değeri `null`
  olur, böylece Kaydet her zaman "kopya olarak kaydet"e düşer: Belgeler/kobiPDF klasörüne yazılır ve Paylaş menüsü açılır.
  Üzerine yazma Android'de yoktur.

**Yapılan (plan eleştirisinden sonra değişenler kalın):**
- **İkinci Vite ayarı yok ama derleme kipi var:** `electron-vite build --mode android`. `@platform-api` takma adı Android'de
  `platform/androidApi.ts`, masaüstünde boş `desktopApi.ts` olur; `main.tsx`'in ilk importu. Masaüstü paketinde Capacitor
  kodu yok (derleme çıktısında arandı). Çalışma anında yüklemek açılışta çökerdi: TitleBar ve ActionButton window.api'yi
  modül yüklenirken okuyor.
- `OpenedFile.path` artık `string | null`; `SavedFile.location` bildirimde konumu gösterir ("Belgeler/kobiPDF/x.pdf kaydedildi").
- İlk Kaydet `Belgeler/kobiPDF/<ad>.pdf` kopyasını açar (varsa "<ad> (2).pdf"), sonraki Kaydet'ler o kopyanın üstüne yazar.
  **Yazım 1,5 MB'lık parçalarla gizli bir geçici dosyaya, sonra yeniden adlandırma**: büyük dosya köprüde tek mesaj olmaz,
  yarıda kalan yazım eski kopyayı bozmaz.
- **Paylaş, kaydetmenin yan etkisi değil, ayrı düğme** (Android'de Yazdır'ın yerinde): kaydeder, sonra paylaş menüsünü açar.
  Paylaşımı kapatmak hata sayılmaz.
- Bölme / çıkarma klasör sormadan Belgeler/kobiPDF'e yazar, var olanı ezmez.
- **Geri tuşu:** kaydedilmemiş belge varsa masaüstündeki "Kaydedilmemiş değişiklikler" penceresi; yoksa uygulama kapanır.
- **Android 9 ve altı için WRITE_EXTERNAL_STORAGE (maxSdk 29) ve izin isteme, Android 10 için requestLegacyExternalStorage.**
- `minWebViewVersion` 110; sürüm adı / kodu `package.json`'dan (0.5.0 -> 500); kobiPDF simgesi (`npm run icons`).
- Yazı tipleri: Adım 4'e kadar sistem yazı tipi yok, DejaVu yedeği kullanılır.

**Telefonda denenen (Redmi 12, Android 15):** uygulama açılıyor; 1 MB ve 53 MB (210 sayfa) PDF açılıyor; Kaydet kopyayı
oluşturuyor, ikinci Kaydet aynı dosyanın üstüne yazıyor; 53 MB kaydetme 45 sn (pdf-lib 26 sn + yazma 19 sn), çökme yok;
sayfa döndürme dosyaya yazılıyor, Üretici "kobiPDF 0.5.0"; Paylaş menüsü açılıyor; kirli belgede geri tuşu soruyor.
Masaüstü derlemesi açılıyor, Yazdır yerinde, Paylaş yok.

**Açık kalanlar:**
- Dosya seçiciyi iptal etme, imza için görsel seçme, bölme: cihazda elle denenmedi (testte seçici atlandı).
- Kaydedilen dosyanın Dosyalar uygulamasında görünmesi (MediaStore) elle kontrol edilmeli.
- Android 7–10 ve uygulama silinip kurulduktan sonra aynı adla kaydetme denenmedi.
- Büyük dosyada kaydetme yavaş ve ilerleme göstergesi yok (Adım 2). Parça boyutu büyütülerek yazma hızlandırılabilir.
- Paket adı `com.hidroteknik.kobipdf` Play'e yüklenince değişmez; kullanıcı onayı bekliyor.
- Daha temiz kaydetme için SAF `ACTION_CREATE_DOCUMENT` (kullanıcı yer seçer) Adım 3'te MainActivity'ye eklenebilir.

## Adım 2 - Telefon kabuğu
- `App.tsx` içinde Android ise şerit menü, başlık çubuğu ve kenar çubuğu yerine üst çubuk (Aç, Kaydet / Paylaş) ve alt çubuk
  (Görüntüle / Metin / Kaşe).
- Dokunmatik: düzenleme katmanlarında `touch-action` ayarı (yoksa kaydırma, taşı / boyutlandırmayı keser); iki parmak
  yakınlaştırmada geçici CSS ölçeği, bırakınca yeniden çizim; parmak boyunda tutamaçlar; telefonda daha düşük tuval sınırı.
- Sanal klavye: yazı düzenlenirken pencere küçülünce yakınlaştırma yeniden hesaplanmaz, düzenleme kutusu klavyenin üstüne kaydırılır.
- İmza / Kaşe penceresi dar ekrana uyar. Liste telefonun kendisinde tutulur, masaüstüyle paylaşılmaz.

## Adım 3 - Android'e özgü kod
- AndroidManifest: `application/pdf` için VIEW ve SEND. Gelen dosyayı web tarafına aktarmak için MainActivity'de küçük Kotlin kodu.
- Döndürme ve arka plana atmada düzenleme kaybolmasın: `configChanges` ayarı.
- Dosya seçici: bakımı süren bir eklenti ya da kendi küçük kodumuz. `MANAGE_EXTERNAL_STORAGE` izni kullanılmaz (Play politikası).

## Adım 4 - Yazı tipleri (masaüstünü de etkiler, ayrı karar)
- Liberation Sans / Serif / Mono (SIL OFL) gömülür; yalnız sistemde Arial / Times / Courier YOKSA kullanılır.
  Windows gerçek Arial'ı kullanmaya devam eder.
- Bilinen sınır: Tahoma, Calibri, Verdana, Segoe'nin ücretsiz ölçü ikizi yok; Android'de DejaVu'ya düşer, yeni yazı biraz geniş görünür.

## Adım 5 - Yayın
- İmzalı AAB GitHub Actions'ta üretilir. İmza anahtarı ve parolaları GitHub Secrets'ta durur, repoya ASLA girmez
  (`.gitignore`: `*.jks`, `*.keystore`, `keystore.properties`; derlemede kontrol).
- Hakkında penceresindeki lisans listesine Capacitor ve Liberation eklenir.
- Play: güncel hedef API seviyesi, tanıtım metni, gizlilik sayfası (hidroteknik.si/gizlilik/kobipdf).

## Çalışma düzeni
Telefonda deneme gereken her adım (0, 2, 3, 5) yerel oturumda, USB bağlı telefonla yapılır.
Her adım kendi `bekleyen/<konu>` dalında. Masaüstüne dokunan değişiklik (Adım 1, 2, 4) yayından önce Windows'ta elle denenir.
