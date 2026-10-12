/*
  ORA Space settings
  ------------------
  Fill these in before launch. Empty values show a graceful "coming soon" line on the page.
  Save the file and the dev server reloads instantly.
*/
export default {
  siteUrl: '',       // the live address, e.g. 'https://oraspace.lk'. Used for link previews, the sitemap and search engines.
  openingDate: '',   // e.g. 'Saturday, 12 December 2026'
  address: '',       // e.g. 'No. 12, Old Lane, Kandy'
  city: '',          // the town, e.g. 'Kandy'. Added to the Google title and description ("…in Kandy, Sri Lanka")
  mapsUrl: '',       // a Google Maps link to the house
  opensAt: 8,        // opening hour on the 24-hour clock (8 = 8.00 am); the "A day at ORA" clock shows Closed outside these hours
  closesAt: 22,      // closing hour (22 = 10.00 pm)
  hours: '',         // optional wording for Visit, e.g. 'Daily, 8.00 am to 10.00 pm' (empty: written from the two hours above)
  email: '',         // e.g. 'hello@yourdomain.com'
  phone: '',         // e.g. '+94 77 123 4567' (also used for the WhatsApp link)
  instagram: '',     // handle without the @
  googleSiteVerification: '',  // optional: the code from Google Search Console's "HTML tag" option (just the content="…" part)
  bingSiteVerification: '',    // optional: the same for Bing Webmaster Tools (the msvalidate.01 code)
  formEndpoint: 'https://formspree.io/f/xaeqbkbw'   // Formspree form for the Opening List. Sign-ups are POSTed here as JSON.
};
