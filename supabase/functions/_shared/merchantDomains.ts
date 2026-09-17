// ─── MERCHANT DIRECTORY ─────────────────────────────────────────────────────
// Maps the store names our scrapers report (Google Shopping "seller" labels,
// marketplace names) onto the retailer's own domain plus the search path that
// lands a shopper on the real product page. Anything not listed here has no
// verified destination, so the product is not shoppable and must not be shown.

export const MERCHANT_DOMAINS: Record<string, string> = {
  // Luxury / designer
  gucci: "gucci.com",
  prada: "prada.com",
  balenciaga: "balenciaga.com",
  "saint laurent": "ysl.com",
  amiri: "amiri.com",
  "tory burch": "toryburch.com",
  allsaints: "us.allsaints.com",
  "moda operandi": "modaoperandi.com",
  editorialist: "editorialist.com",
  yoox: "yoox.com",
  lyst: "lyst.com",
  "net-a-porter": "net-a-porter.com",
  "net-a-porter.com": "net-a-porter.com",
  farfetch: "farfetch.com",
  ssense: "ssense.com",
  fwrd: "fwrd.com",
  revolve: "revolve.com",
  coach: "coach.com",

  // Department stores
  "macy's": "macys.com",
  "saks fifth avenue": "saksfifthavenue.com",
  "neiman marcus": "neimanmarcus.com",
  "bloomingdale's": "bloomingdales.com",
  nordstrom: "nordstrom.com",
  "dillard's": "dillards.com",
  "kohl's": "kohls.com",
  jcpenney: "jcpenney.com",
  "lord & taylor": "lordandtaylor.com",
  target: "target.com",
  walmart: "walmart.com",

  // Mainstream apparel
  "h&m": "www2.hm.com",
  "zara usa": "zara.com",
  zara: "zara.com",
  uniqlo: "uniqlo.com",
  "shop.mango.com": "shop.mango.com",
  mango: "shop.mango.com",
  gap: "gap.com",
  "old navy": "oldnavy.gap.com",
  "banana republic": "bananarepublic.gap.com",
  "banana republic factory": "bananarepublicfactory.gapfactory.com",
  "american eagle outfitters": "ae.com",
  aerie: "ae.com",
  "abercrombie & fitch": "abercrombie.com",
  "hollister co - official": "hollisterco.com",
  hollister: "hollisterco.com",
  express: "express.com",
  "j.crew": "jcrew.com",
  "j.crew factory": "factory.jcrew.com",
  madewell: "madewell.com",
  "free people": "freepeople.com",
  anthropologie: "anthropologie.com",
  "urban outfitters": "urbanoutfitters.com",
  aritzia: "aritzia.com",
  "ann taylor": "anntaylor.com",
  loft: "loft.com",
  talbots: "talbots.com",
  maurices: "maurices.com",
  "white house black market": "whitehouseblackmarket.com",
  "coldwater creek": "coldwatercreek.com",
  "lands' end": "landsend.com",
  "levi's": "levi.com",
  bonobos: "bonobos.com",
  "men's wearhouse": "menswearhouse.com",
  lulus: "lulus.com",
  windsor: "windsorstore.com",
  asos: "asos.com",
  "boohoo usa": "boohoo.com",
  "boohooman us": "boohooman.com",
  "nasty gal - us": "nastygal.com",
  missguided: "missguided.co.uk",
  "oh polly us": "ohpolly.com",
  "petal & pup usa": "petalandpup.com",
  "lucy in the sky": "lucyinthesky.com",
  "i.am.gia us": "iamgia.com",
  edikted: "edikted.com",
  cider: "shopcider.com",
  meshki: "meshki.us",
  "meshki.us": "meshki.us",
  quince: "quince.com",
  commense: "thecommence.com",
  micas: "micas.com",
  akira: "shopakira.com",
  "fashion nova": "fashionnova.com",
  "cupshe.com": "cupshe.com",
  cupshe: "cupshe.com",
  "the mint julep boutique": "shopthemint.com",
  "lane 201 boutique": "lane201boutique.com",
  comfrt: "comfrt.com",
  youngla: "youngla.com",
  "culture kings": "culturekings.com",
  zumiez: "zumiez.com",
  tillys: "tillys.com",
  "rockstar original": "rockstaroriginal.com",
  lululemon: "lululemon.com",

  // Sport / outdoor / footwear
  "dick's sporting goods": "dickssportinggoods.com",
  rei: "rei.com",
  "columbia sportswear": "columbia.com",
  "backcountry.com": "backcountry.com",
  "zappos.com": "zappos.com",
  zappos: "zappos.com",
  goat: "goat.com",
  skechers: "skechers.com",
  "skechers.com": "skechers.com",
  "keds.com": "keds.com",
  keds: "keds.com",
  "nunn bush shoes": "nunnbush.com",
  "pants store": "pantsstore.com",
  "penner's": "pennersinc.com",
  ssg: "ssg.com",

  // Marketplaces
  ebay: "ebay.com",
  poshmark: "poshmark.com",
  "etsy - seller": "etsy.com",
  etsy: "etsy.com",
  temu: "temu.com",
  lightinthebox: "lightinthebox.com",
};

// Sites whose search lives somewhere other than /search?q=
const SEARCH_TEMPLATES: Record<string, string> = {
  "www2.hm.com": "https://www2.hm.com/en_us/search-results.html?q=",
  "macys.com": "https://www.macys.com/shop/featured/",
  "zara.com": "https://www.zara.com/us/en/search?searchTerm=",
  "target.com": "https://www.target.com/s?searchTerm=",
  "walmart.com": "https://www.walmart.com/search?q=",
  "ebay.com": "https://www.ebay.com/sch/i.html?_nkw=",
  "etsy.com": "https://www.etsy.com/search?q=",
  "poshmark.com": "https://poshmark.com/search?query=",
  "temu.com": "https://www.temu.com/search_result.html?search_key=",
  "amiri.com": "https://www.amiri.com/search?q=",
  "gucci.com": "https://www.gucci.com/us/en/search?searchString=",
  "prada.com": "https://www.prada.com/us/en/search.html?q=",
  "ysl.com": "https://www.ysl.com/en-us/search?q=",
  "uniqlo.com": "https://www.uniqlo.com/us/en/search?q=",
  "nordstrom.com": "https://www.nordstrom.com/sr?keyword=",
  "rei.com": "https://www.rei.com/search?q=",
  "zappos.com": "https://www.zappos.com/search?term=",
  "goat.com": "https://www.goat.com/search?query=",
  "lululemon.com": "https://shop.lululemon.com/search?Ntt=",
};

/** Normalize a store label to its retailer domain, or null when unknown. */
export function merchantDomain(merchant?: string | null): string | null {
  const key = merchant?.trim().toLowerCase();
  if (!key) return null;
  const direct = MERCHANT_DOMAINS[key] ?? MERCHANT_DOMAINS[key.replace(/\.com$/, "")];
  if (direct) return direct;
  const dotted = key.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(dotted) ? dotted : null;
}

/** Build a retailer search URL that lands on the real product page. */
export function merchantProductSearchUrl(
  merchant?: string | null,
  productName?: string | null,
): string | null {
  const domain = merchantDomain(merchant);
  const q = productName?.trim();
  if (!domain || !q) return null;
  const template = SEARCH_TEMPLATES[domain];
  return template ? `${template}${encodeURIComponent(q)}` : `https://${domain}/search?q=${encodeURIComponent(q)}`;
}
