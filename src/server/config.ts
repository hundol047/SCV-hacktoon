export function appURL(){if(process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL)return 'https://'+process.env.VERCEL_URL;return process.env.BOPok_APP_URL||(process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:undefined);}

export function quotaLimit(name:string,fallback:number,maximum=1000000){const value=Number(process.env[name]??fallback);if(!Number.isSafeInteger(value)||value<1||value>maximum)throw Error('Invalid quota configuration');return value;}
