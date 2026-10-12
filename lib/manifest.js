/* =========================================================================
   Bloom Coffee & Brunch: business data (official brief, edit HERE)
   The visible contact data is also written in index.html so the page works
   without JavaScript; keep both in sync if anything changes.
   ========================================================================= */
(function () {
  "use strict";
  window.__BRAND__ = {
    name: "Bloom Coffee & Brunch",
    address: "Calle Ángel Llanos, 10, Vigo, España",
    mapsQuery: "Calle Ángel Llanos 10, Vigo",
    phone: "+34 640 24 01 76",
    whatsapp: "34640240176",
    email: "bloomcoffeeb@gmail.com",
    instagram: "https://www.instagram.com/bloom.coffe.vigo/",
    tiktok: "https://www.tiktok.com/@bloomcoffe_vigo",
    timeZone: "Europe/Madrid",
    // Opening hours by weekday (0 = domingo). Minutes from midnight; null = cerrado.
    hours: {
      0: null,
      1: [540, 1320], 2: [540, 1320], 3: [540, 1320], 4: [540, 1320], 5: [540, 1320],
      6: [600, 1380]
    },
    mapEmbed: true
  };
})();
