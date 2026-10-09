/* =========================================================================
   Bloom Coffee Brunch: business data (edit HERE, not in main.js)
   Leave a field as "" and its button stays hidden. Nothing fake is shown.
   ========================================================================= */
(function () {
  "use strict";
  window.__BRAND__ = {
    name: "Bloom Coffee Brunch",

    // Confirmed from the café's own poster. Please double-check the spelling.
    address: "Calle Ángel Janos, 10<br>Vigo",
    mapsQuery: "Bloom Coffee Brunch, Calle Ángel Janos 10, Vigo",

    // Contact: PENDING. Fill in only verified data.
    phone: "",        // e.g. "+34 600 000 000"
    whatsapp: "",     // digits with country code, e.g. "34600000000"
    instagram: "",    // full URL, e.g. "https://www.instagram.com/bloom..."
    email: "",        // e.g. "hola@bloomcoffeebrunch.com"

    // Main product: price and note are optional
    star: {
      price: "",      // e.g. "8,50 €"
      note: "Pregunta en barra por los toppings y el precio del día."
    },

    // Show the embedded Google map (no API key needed)
    mapEmbed: true
  };
})();
