/*
  ORA Space settings
  ------------------
  Fill these in before launch. Empty values show a graceful "coming soon" line on the page.
  Save the file and the dev server reloads instantly.
*/
export default {
  siteUrl: '',       // the live address, e.g. 'https://oraspace.lk'. Used for link previews, the sitemap and search engines.
  openingDate: '',   // e.g. 'Saturday, 12 December 2026'
  address: '3, Wewala, 1 Church Rd, Piliyandala 10300',   // written exactly as on the Google Business Profile
  city: 'Piliyandala',   // the town. Added to the Google title ("…in Piliyandala") and descriptions ("…in Piliyandala, Sri Lanka")
  // a Google Maps link to the house. For the exact pin, replace this with the link from Google Maps > Share > Copy link
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=ORA%20Space%2C%203%2C%20Wewala%2C%201%20Church%20Rd%2C%20Piliyandala%2010300',
  opensAt: 8,        // opening hour on the 24-hour clock (8 = 8.00 am); the "A day at ORA" clock shows Closed outside these hours
  closesAt: 22,      // closing hour (22 = 10.00 pm)
  openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],   // the days ORA is open; the others show as closed
  hours: '',         // optional wording for Visit, e.g. 'Daily, 8.00 am to 10.00 pm' (empty: written from the two hours above)
  email: '',         // e.g. 'hello@yourdomain.com'
  phone: '+94 77 483 8430',   // with +94, so the call and WhatsApp links work from anywhere
  instagram: 'ora_space.co',   // handle without the @
  facebook: 'https://www.facebook.com/profile.php?id=61594889082886',   // the Facebook page address
  googleSiteVerification: '',  // optional: the code from Google Search Console's "HTML tag" option (just the content="…" part)
  bingSiteVerification: '',    // optional: the same for Bing Webmaster Tools (the msvalidate.01 code)
  formEndpoint: 'https://formspree.io/f/xaeqbkbw'   // Formspree form for the Opening List. Sign-ups are POSTed here as JSON.
};
