import { Helmet } from "react-helmet-async";

const DOMAIN = "https://noteflex.app";
const DEFAULT_OG_IMAGE = `${DOMAIN}/og-image.png`;

interface SeoProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: "website" | "article";
  lang?: string;
  /** ko·en 절대 URL 쌍이 있을 때만 hreflang 주입 */
  alternates?: { ko: string; en: string };
}

export default function Seo({
  title,
  description,
  canonical,
  ogImage,
  ogType = "website",
  lang = "ko",
  alternates,
}: SeoProps) {
  const image = ogImage || DEFAULT_OG_IMAGE;

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* hreflang — alternates가 있을 때만 */}
      {alternates && <link rel="alternate" hreflang="ko" href={alternates.ko} />}
      {alternates && <link rel="alternate" hreflang="en" href={alternates.en} />}
      {alternates && <link rel="alternate" hreflang="x-default" href={alternates.en} />}
    </Helmet>
  );
}
