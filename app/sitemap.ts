import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://gestopro-lake.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
