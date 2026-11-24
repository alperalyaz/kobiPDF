# kobiPDF Android planı (Capacitor, aynı repo)

Durum (24.11.2026): Adım 0-4 `main`'de. Adım 5: Play'de kapalı test incelemede; PrimeTestLab siparişi ve 14 günlük
test bekleniyor, sonra üretim erişimi başvurusu.
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

**Yapılan (plan eleştirisinden sonra):**
- `components/phone/PhoneApp.tsx`: üst çubuk (dosya adı, Geri Al, Kaydet, Paylaş, ⋮ menü: Aç, Genişliğe sığdır, Kapat,
  Hakkında, Dil), bağlamsal çubuk (yazı düzenlerken özellikler + Tamam; seçili nesnede Sil + Tamam; Metin kipinde ipucu +
  Yeni metin), alt çubuk Görüntüle / Metin / İmza (İmza: çiz ya da kaşe resmi yükle). Klavye açıkken alt çubuk gizlenir.
- **Tek belge:** telefonda Aç, açık belgenin kaydedilmemiş değişikliklerini sorar, sonra yerine geçer (`openReplacing`).
  Yeni ve Farklı Kaydet telefonda yok.
- **Dokunma (`editing/pointer.ts`):** `onTap` ile parmakla yapılan eylemler (yazıya dokunup düzeltme, yeni metin, not,
  dışarı dokunup taslağı bitirme / seçimi kaldırma) parmak kalkınca ve kıpırdamadıysa çalışır; yazının üstünden başlayan
  kaydırma düzenleme açmaz. `trackPointer`'a `onCancel`: tarayıcı kaydırmayı devralınca ya da ikinci parmak gelince
  sürükleme iz bırakmadan iptal olur. Seçili olmayan nesne dokunulunca seçilir, üstünden kaydırmak onu taşımaz;
  seçili nesne `touch-action: none` olup parmakla taşınır. Fareyle davranış değişmedi.
- **İki parmak yakınlaştırma:** hareket boyunca yalnız CSS ölçeği, bırakınca tek `setZoom`; parmakların ortası yerinde
  kalır. En az genişliğe sığdırmanın yarısı.
- **Tuval belleği (masaüstünü de düzeltir):** 2 sn'den uzun görünmeyen sayfanın bitmap'i atılır. Telefonda piksel oranı
  en fazla 2, tuval sınırı 8 M piksel.
- **Geri tuşu yığını (`platform/back.ts`):** pencere, menü, yazı düzenleme, seçim, Metin kipi sırayla kapanır; en sonda
  kaydedilmemiş değişiklik sorusu ya da çıkış. Kaydetme sürerken Geri bir şey yapmaz.
- **Kaydetme göstergesi (`services/busy.ts`, `BusyOverlay`):** tam ekran "Kaydediliyor...", kayıt sürerken Kaydet /
  Farklı Kaydet / Paylaş yok sayılır. Masaüstünde de görünür (kaydetme penceresi göstergenin arkasında kalmaz).
- İmza görünen alanın ortasına konur ve seçili gelir (masaüstünde de görünen alanın ortası). İmza penceresi dar ekrana
  uyar, kayıtlı imzanın silme düğmesi telefonda hep görünür. Pencere ve bildirim genişliği ekranı aşmaz.
- Klavye: Android pencereyi küçültüyor (ölçüldü: 840 -> 510 px), düzenleme kutusu görünür alana kaydırılır.

**Telefonda denenen (Redmi 12, gerçek dokunma olaylarıyla):** yazının üstünden kaydırma düzenleme açmıyor, dokunma açıyor,
klavye geliyor; Tamam kaydedip klavyeyi kapatıyor; Geri Metin kipinden ve menüden çıkıyor; imza parmakla çiziliyor,
görünen alana yerleşiyor, seçiliyken taşınıyor, seçili değilken üstünden kaydırma onu oynatmıyor; iki parmakla 2,5 kat
yakınlaştırma ve alt sınır; 210 sayfanın sonuna kaydırınca bellek artmıyor (yalnız 3 sayfanın bitmap'i duruyor);
53 MB kaydetme 41 sn, gösterge açıkken ikinci Kaydet yeni dosya üretmiyor. Masaüstü derlemesi açılıyor.

**Açık kalanlar:**
- Elle (gerçek parmakla) deneme ve ekran kaydı: otomatik testler tarayıcının kaydırma / kıstırma kararını birebir taklit etmez.
- Masaüstünde Windows'ta elle: fareyle taşıma, boyutlandırma, Ctrl+tekerlek, El aracı, kaydetme göstergesi, imzanın yeri.
- Yazı düzenlenince DejaVu genişliği yüzünden satır sayfadan taşabiliyor (Adım 4).
- Kaydetme ilerleme yüzdesi yok, yalnız "Kaydediliyor...". Telefonda yazı düzenlerken küçük yazıya otomatik yakınlaşma yok.
- İmza penceresindeki ipucu "Fare veya kalemle çizin" diyor; telefona uygun metin yok.

## Adım 3 - Android'e özgü kod
- AndroidManifest: `application/pdf` için VIEW ve SEND. Gelen dosyayı web tarafına aktarmak için MainActivity'de küçük Kotlin kodu.
- Döndürme ve arka plana atmada düzenleme kaybolmasın: `configChanges` ayarı.
- Dosya seçici: bakımı süren bir eklenti ya da kendi küçük kodumuz. `MANAGE_EXTERNAL_STORAGE` izni kullanılmaz (Play politikası).

**Yapılan (plan eleştirisinden sonra):**
- Manifest: VIEW ve SEND, yalnız `application/pdf` (octet-stream her ikili dosyada kobiPDF'i önerirdi; bilerek yok).
  Birden çok dosya paylaşma (SEND_MULTIPLE) yok. Dosya seçici Adım 1'deki `<input type=file>` olarak kaldı.
- `IncomingFilePlugin.java` (Java, Kotlin değil): gelen dosya yerel kuyrukta bekler, sayfa ister (`takePending`); olay
  yalnız "bak" sinyali. Soğuk açılışta da kaybolmaz. Sayfaya yalnız kısa bir kimlik gider, content:// adresi değil.
  `copy` dosyayı önbelleğe akışla kopyalar, `%PDF` imzasını denetler; sayfa kopyayı yerel sunucudan okur (köprüden base64
  geçmez), sonra `discard`. Ad: DISPLAY_NAME, yoksa başlık, yoksa adresin son parçası.
- MainActivity: geri yüklenen etkinlikte (süreç ölümü, Son kullanılanlar) açılış intent'i yeniden açılmaz, izni zaten yok.
- Sayfa (`openIncoming`): tek kuyruk, sırayla; kayıt sürerken gelen dosya kaydın bitmesini bekler. Önce kopyala ve
  doğrula ("Belge yükleniyor..."), sonra "kaydedilsin mi?", sonra açık belgenin yerine geç.
- Ekran kapalıyken sayfa animasyon karesi almaz: kaydetme göstergesi artık onu beklemiyor.
- `configChanges` Capacitor'dan geliyor (döndürmede etkinlik yeniden kurulmaz).

**Telefonda denenen (adb ile VIEW / SEND, okuma izniyle):** uygulama kapalıyken açılış (kilitli ekranda da); uygulama
açıkken 53 MB dosya (kilit açılınca tamamlandı); kirli belgede "kaydedilsin mi?" sorusu, İptal belgeyi tutuyor,
Kaydetme yenisini açıyor; temiz belgede doğrudan yerine geçiyor; Geri, Android 15'in öngörülü geri hareketiyle de geliyor;
kaydedilen dosyalar MediaStore'da (Dosyalar uygulamasında) görünüyor.

**Açık kalanlar:**
- Gerçek uygulamalarla elle: Google Files, WhatsApp, Gmail eki, Chrome indirmesi, Drive (yavaş bulut kaynağı, iptal yok).
- Süreç ölümü sonrası Son kullanılanlar'dan dönüş ve ekran döndürme elle denenmeli.
- WhatsApp'tan paylaşınca Geri kullanıcıyı WhatsApp'a değil ana ekrana götürür (singleTask; kabul edildi).
- Paylaşılan dosya kaydedilince orijinal değişmez, `Belgeler/kobiPDF/<ad>.pdf` kopyası yazılır (bildirim konumu söylüyor).

## Adım 4 - Yazı tipleri (masaüstünü de etkiler, ayrı karar)
- Liberation Sans / Serif / Mono (SIL OFL) gömülür; yalnız sistemde Arial / Times / Courier YOKSA kullanılır.
  Windows gerçek Arial'ı kullanmaya devam eder.
- Bilinen sınır: Tahoma, Calibri, Verdana, Segoe'nin ücretsiz ölçü ikizi yok; Android'de DejaVu'ya düşer, yeni yazı biraz geniş görünür.

**Yapılan (plan eleştirisinden sonra; Liberation npm'de yok, aynı ölçülü Google yazı tipleri kullanıldı):**
- Ölçü ikizleri (SIL OFL 1.1, `@expo-google-fonts/*`, tam sürüm): Arial -> Arimo, Times New Roman -> Tinos,
  Courier New -> Cousine, **Calibri -> Carlito, Georgia -> Gelasio** (plan Calibri'nin ikizi yok diyordu; yanlıştı).
  fontkit ölçümü: Türkçe örnek cümlede genişlik farkı beşinde de %0,000; ğüşıöçĞÜŞİÖÇ var; Carlito ve Cousine'de ₺ yok.
  Yalnız 400/700 düz ve italik dosyalar (20 dosya). Tahoma, Verdana, Segoe, Consolas vb. için ikiz yok: DejaVu.
- `fonts.ts`: aile başına tek kaynak; sistemde gerçek yazı tipi varsa o (Windows), yoksa ikizi, o da yoksa DejaVu.
  Seçim listesinde "Calibri (Carlito)" gibi görünür. İkizler CSS url() ile yüklenir (JS'te bayt kopyası tutulmaz).
  Taban çizgisi için ascent/descent çizilen yüzden alınır (Carlito 0,952/0,269, Calibri 0,75/0,25).
- Yarış: yazı tipi yüklenmeden ölçülürse kutu yanlış genişlikte kalıyordu; `whenFontReady` ile yüklenince yeniden ölçülür.
- Harf aralığı (kerning) ve bitişik harfler ekranda ve ölçümde kapalı: pdf-lib kaydederken uygulamıyor, böylece ekran = PDF.
  (Masaüstünü de etkiler: kerning'li çiftlerde yeni yazı çok az geniş görünür, ama kayıtla aynıdır.)
- Kaydederken yazı tipinde olmayan bir karakter (ör. Carlito'da ₺) varsa o yazı DejaVu ile gömülür; yoksa PDF'te boş
  kutu çıkıyordu. Bu durumda kaydedilen satır ekrandakinden biraz geniş olabilir.
- Yeni metnin varsayılan yazı tipi Arial (Windows'ta gerçek Arial, telefonda Arimo); önceden DejaVu Sans'tı.
- Hakkında: Capacitor ve AndroidX (Android), Electron (masaüstü), ikiz yazı tipleri ve tam OFL metinleri (açılır bölüm).
- Telefonda klavye açıkken üst çubuk ve sayfa numarası gizlenir (yatay ekranda başka yer kalmıyordu).

**Telefonda denenen:** 1mb.pdf'teki Calibri Bold başlık "Calibri (Carlito)" olarak tanındı; düzeltilen satır 263 px,
orijinal 263 px (önce DejaVu ile sayfadan taşıyordu). ₺'li satır kaydedilince DejaVuSans-Bold ile gömüldü, "fiyat"
kelimesi PDF'te doğru okunuyor, sayfanın geri kalanı orijinal Calibri. Yatay ekranda arayüz ve belge korunuyor.
Masaüstünde her aile için tek kaynak (4 yüz) kayıtlı. APK 19,5 MB.

**Açık kalanlar:** Windows'ta elle: yeni metin Arial, kaydedilen PDF'te gerçek Arial adı; telefonda açılış süresi /
bellek ölçülmedi (12 DejaVu + 20 ikiz yüz açılışta yükleniyor); Helvetica (gömülü olmayan) bir PDF'te deneme.

## Adım 5 - Yayın
- İmzalı AAB GitHub Actions'ta üretilir. İmza anahtarı ve parolaları GitHub Secrets'ta durur, repoya ASLA girmez
  (`.gitignore`: `*.jks`, `*.keystore`, `keystore.properties`; derlemede kontrol).
- Hakkında penceresindeki lisans listesi: yapıldı (Adım 4).
- Play: güncel hedef API seviyesi, tanıtım metni, gizlilik sayfası (hidroteknik.si/gizlilik/kobipdf).

**Yapılan (plan eleştirisinden sonra):**
- Yükleme anahtarı `C:\Users\user\kobipdf-android-keys\` (upload.jks + keystore.properties, PKCS12, RSA 4096); repo dışında,
  GitHub Secrets'ta da (ANDROID_KEYSTORE_BASE64 / _PASSWORD / ANDROID_KEY_ALIAS). Play App Signing açık.
- Yerel imzalı derleme: `$env:KOBIPDF_KEYSTORE_PROPERTIES = "C:\Users\user\kobipdf-android-keys\keystore.properties"`,
  `npm run android:sync`, `android\gradlew.bat bundleRelease`. İmza kontrolü yalnız release görevlerinde.
- CI: `.github/workflows/android.yml`, `android-v*` etiketi ya da elle; AAB artefakt olarak (GitHub Release'e konmaz).
- versionCode = major*1000000 + minor*10000 + patch*100 + ANDROID_BUILD (0.5.0 -> 50000). Asla küçültülmez.
- `allowBackup=false`: kayıtlı imzalar buluta yedeklenmez. Hakkında'da gizlilik politikası bağlantısı (Play şartı).
- Mağaza: `docs/store/play/` (TR/EN metin, 512 simge, 1024x500 öne çıkan görsel, 5 telefon görüntüsü 1080x2160).
  Ekran görüntüleri Android derlemesinin tarayıcıda 392x840 @2,75 (Redmi 12) çiziminden, puppeteer-core + başsız Chrome.
- Play Console (Hidroteknik, kişisel hesap): uygulama "kobiPDF: PDF Düzenle, İmzala", ücretsiz, varsayılan dil Türkçe.
  Beyanlar: veri toplanmıyor, reklam yok, reklam kimliği yok, 18+, IARC 3+ / PEGI 3, devlet/finans/sağlık değil, tacir
  (hesaptan). Kategori Verimlilik; iletişim software@hidroteknik.com.tr, web https://www.hidroteknik.si.
- Dahili test yayında (Hidroteknik Test listesi): https://play.google.com/apps/internaltest/4701270612403500765
- Kapalı test (Alpha, 178 ülke) Google incelemesine gönderildi. Katılım: https://play.google.com/apps/testing/com.hidroteknik.kobipdf

**Kişisel hesap kuralı:** üretimden önce kapalı test, en az 12 testçi 14 gün kesintisiz; sonra Dashboard'dan üretim erişimi
başvurusu. Testçiler PrimeTestLab'den (primetestlab.com, Enterprise 25 testçi, 29,49 $; önceki siparişler Megafon vb.).
Sipariş sonrası: paneldeki adresleri kapalı test e-posta listesine ekle, test bağlantısını panele gir.

**Durum (2026-11-24):** kapalı test incelemesi geçti, 0.5.0 (50000) kapalı test kanalında yayında.
PrimeTestLab siparişi P07026973 (Starter, 12 testçi, 14 gün) ödendi ve kuruldu. Testçiler kapalı teste e-posta listesiyle
değil Google Grubuyla eklendi: khadem-testers-service@googlegroups.com (bu yüzden "Hidroteknik Test" listesi artık kapalı
testte değil; dahili testte duruyor). Değişiklik Google incelemesine gönderildi; PrimeTestLab onaydan sonra 30 dk-8 saat
içinde başlatır. 14 gün dolunca Dashboard'dan üretim erişimi başvurusu.

**Açık kalanlar:** 14 gün sonra üretim başvurusu; Play'den
kurulan imzalı sürümün telefonda denenmesi (dahili test bağlantısı); İngilizce sayfaya İngilizce ekran görüntüleri.

**Play'de olmayan, main'de bekleyen değişiklikler (0.5.0 / 50000'den sonra):**
- Hakkında penceresi telefona uyarlandı (sekmeler üstte, telefona özel Nasıl kullanılır / SSS metinleri).
- Varsayılan PDF uygulaması yardımı (`DefaultPdfPlugin`, `DefaultPdfCard`): karşılama ekranında kart, Hakkında > Genel'de
  satır. Android kendini varsayılan yapmaya izin vermez; kart sistemin "Birlikte aç" listesini (kobiPDF + Her zaman) ya da
  başka uygulama seçilmişse onun ayarlarını ("Varsayılanları temizle") açar. Telefonda durum algılama ve "seçildi"
  sinyali denendi; gerçek "Her zaman" dokunuşu henüz denenmedi.

Karar (2026-11-24): kapalı test incelemesi bitmeden yeni AAB yüklenmeyecek (inceleme baştan başlayabilir); başka
değişiklikler de birikince tek sürüm olarak yüklenecek (ANDROID_BUILD=1 → versionCode 50001, ya da yeni sürüm numarası).

## Çalışma düzeni
Telefonda deneme gereken her adım (0, 2, 3, 5) yerel oturumda, USB bağlı telefonla yapılır.
Her adım kendi `bekleyen/<konu>` dalında. Masaüstüne dokunan değişiklik (Adım 1, 2, 4) yayından önce Windows'ta elle denenir.
