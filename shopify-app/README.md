# Faceshion · Shopify App (Theme App Extension)

Bu klasör, Faceshion Try-On butonunu Shopify mağazalarına **tema editöründen tek tıkla** eklemeyi sağlayan Shopify uygulamasını içerir. Mağaza sahipleri kod yazmadan ürün sayfalarına AI try-on butonunu yerleştirebilir.

## Mimari

- **Tip:** Theme App Extension (sadece Liquid + JS — server tarafı yok)
- **Section block:** `extensions/faceshion-tryon/blocks/tryon_button.liquid`
- **App embed:** `extensions/faceshion-tryon/blocks/tryon_embed.liquid`
- **JS:** mevcut `https://faceshion.app/embed.js` (overlay try-on)
- **Backend:** yok (OAuth gerekmiyor; merchant `merchant_id` girer)

## Yerel geliştirme

```bash
cd shopify-app
npm install
npx shopify app dev
```

Shopify CLI seni Partners hesabınla login eder, bir development store seçtirir ve eklentiyi otomatik o store'a yükler. Tema editöründe iki kullanım vardır:

- Ürün sayfasında ilgili bölüm içinde: **Add block → Apps → Try-On Button**
- Global yüzen buton olarak: **Theme settings → App embeds → Try-On Floating**

## Üretime deploy

```bash
npm install
npx shopify app info     # burada Theme extension görünmeli
npx shopify app deploy
```

Bu komut yeni bir **app version** oluşturur ve Partners dashboard'da "Release" tuşuna basınca tüm yüklü mağazalara dağıtılır. Eğer `app info` çıktısında `Faceshion Try-On` theme extension görünmüyorsa, deploy edilen app version içinde blok yoktur ve tema editöründe de görünmez.

## Kurulum linki (Custom Distribution)

App Store review sürecini atlamak için Partners → App → Distribution → **Custom distribution** seç. Üretilen install linkini müşteriye yolla:

```
https://admin.shopify.com/oauth/install_custom_app?client_id=<CLIENT_ID>&signature=<SIG>
```

Müşteri linke tıklar → app yüklenir → tema editöründen `Try-On Button` bloğunu ürün sayfasına ekler veya `Try-On Floating` embed'ini açar → `merchant_id` alanına Faceshion dashboard'undaki ID'yi yapıştırır. Bitti.

## İlk kurulum (geliştirici tarafı, tek seferlik)

1. https://partners.shopify.com → Apps → **Create app** → "Create app manually"
2. App name: `Faceshion Try-On`, App URL: `https://faceshion.app`
3. API credentials sayfasındaki **Client ID**'yi al, `shopify.app.toml` içine yapıştır.
4. Distribution → **Custom distribution** seç.
5. `npx shopify app deploy` ile ilk versiyonu yayınla, Partners'da "Release" tıkla.
6. Custom install linkini Faceshion sitesinde `/shopify` sayfasında müşterilere göster.

## Notlar

- Partners → **Yüklemeler** ekranında app'in yüklü görünmesi tek başına yeterli değildir; mağazaya yansıması için **theme extension içeren app version deploy + release** edilmiş olmalı.
- Section block bazı tema bölümlerinde görünmeyebilir; bu durumda **Theme settings → App embeds → Try-On Floating** embed'i tüm Online Store 2.0 temalarında çalışır.
- Theme App Extension'larda Shopify CSS dosyası enjekte etmez; tüm stil `embed.js` içinde inline yapılır (mevcut embed kodumuz zaten böyle çalışıyor).
- `merchant_id` alanı zorunlu — boş bırakılırsa branding çekilmez ama buton yine çalışır (default mor/pembe stil).
- `Try-On Button` section block'u tüm şablonlarda eklenebilir; ürün olmayan sayfalarda mevcut sayfa URL'sini fallback olarak kullanır.
