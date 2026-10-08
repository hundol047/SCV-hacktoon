import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", experimental: { cpus: 2 }, outputFileTracingIncludes:{'/api/tourism':['./data/korea-tourism/*.json*'],'/api/tourism/download':['./data/korea-tourism/*.json*'],'/api/catalog':['./data/korea-tourism/*.json*']} };
export default config;
