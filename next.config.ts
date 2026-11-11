import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", skipTrailingSlashRedirect:true, experimental: { cpus: 2, turbopackFileSystemCacheForBuild: false }, outputFileTracingIncludes:{'/lab/[[...path]]':['./vendor/my-ai-lab/**/*'],'/api/tourism':['./data/korea-tourism/*.json*'],'/api/tourism/download':['./data/korea-tourism/*.json*'],'/api/catalog':['./data/korea-tourism/*.json*']} };
export default config;
