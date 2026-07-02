import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://gestopro-lake.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/register", "/setup", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
